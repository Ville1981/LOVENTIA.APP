/**
 * Application entrypoint (Express)
 * - Hardens security headers and input sanitization
 * - Robust Mongo connection with diagnostics
 * - Correct Stripe webhook mounting order (raw body BEFORE json)
 * - Mounts core API routes (auth, users, messages, payment, billing, admin, discover)
 * - Mounts premium-related routes (likes, superlikes, rewind) and search with premium-only dealbreakers
 * - Serves uploads, optional SPA client, and provides health endpoints
 * - Initializes Socket.io (if socket.js present)
 * - Graceful shutdown on SIGINT/SIGTERM
 */

'use strict';

require('dotenv').config();
const { checkThreshold } = require('./utils/alertRules.js');

const express       = require('express');
const mongoose      = require('mongoose');
const cookieParser  = require('cookie-parser');
const path          = require('path');
const fs            = require('fs');

const morgan        = require('morgan');
const compression   = require('compression');
const responseTime  = require('response-time');
const { v4: uuidv4} = require('uuid');

const corsConfig      = require('./config/corsConfig.js');
const securityHeaders = require('./utils/securityHeaders.js');
const swagger         = require('./swagger-config.js');

const xssSanitizer = require('./middleware/xssSanitizer.js');
const sqlSanitizer = require('./middleware/sqlSanitizer.js');

const { validateBody } = require('./middleware/validateRequest.js');

let loginSchema, registerSchema;
try {
  ({ loginSchema, registerSchema } = require('./src/api/validators/authValidator.js'));
} catch (_) {
  try {
    ({ loginSchema, registerSchema } = require('./validators/authValidator.js'));
  } catch (_e) {
    // Optional: controllers will still validate server-side.
  }
}

// Prefer src/api/controllers; fallback to api/controllers; finally null (routes still work)
let authController;
try {
  authController = require('./src/api/controllers/authController.js');
} catch (_) {
  try {
    authController = require('./api/controllers/authController.js');
  } catch (_e) {
    authController = null;
  }
}

const authorizeRoles = require('./middleware/roleAuthorization.js');
const { pathToFileURL } = require('url');

// Dynamic import helper to support ESM/CJS for authenticate middleware
const authenticateModuleURL = pathToFileURL(
  path.resolve(__dirname, './middleware/authenticate.js')
).href;

async function authenticate(req, res, next) {
  try {
    const mod = await import(authenticateModuleURL);
    const fn = (mod && (mod.default || mod.authenticate)) || mod;
    return fn(req, res, next);
  } catch (err) {
    return next(err);
  }
}

// Ensure core models are registered (safe to require even if not directly used here)
try { require(path.resolve(__dirname, './models/User.js')); } catch(_) {}
try { require(path.resolve(__dirname, './models/Message.js')); } catch (_) {}
try { require(path.resolve(__dirname, './models/Payment.js')); } catch (_) {}

// ──────────────────────────────────────────────────────────────────────────────
// App bootstrap
// ──────────────────────────────────────────────────────────────────────────────
const app = express();

const IS_TEST = process.env.NODE_ENV === 'test';
const IS_PROD = process.env.NODE_ENV === 'production';
const IS_DEV  = !IS_TEST && !IS_PROD;

// Optional i18n static (server-served locales). Client can also serve these.
if (process.env.USE_SERVER_LOCALES === 'true') {
  app.use(
    '/locales',
    express.static(path.join(process.cwd(), 'public', 'locales'), {
      fallthrough: false,
      index: false,
      maxAge: 0,
    })
  );
  console.log('[i18n] Serving locales from server at /locales');
}

// Attach a request-id for correlation & diagnostics
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  next();
});

// Lightweight access log (skip in tests)
if (!IS_TEST) {
  app.use(morgan(IS_PROD ? 'combined' : 'dev'));
}

// Add X-Response-Time header (diagnostics)
app.use(responseTime());

// Gzip/deflate compression (safe for JSON & static)
app.use(compression());

// Swagger UI
app.use('/api-docs', swagger.serve, swagger.setup);

// ──────────────────────────────────────────────────────────────────────────────
/* MongoDB connection */
// ──────────────────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

try {
  // Disable buffering so queries fail fast if not connected.
  mongoose.set('strictQuery', false);
  mongoose.set('bufferCommands', false);
} catch (_) {}

function logConnState() {
  const s = mongoose.connection.readyState;
  const map = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  console.log(`[Mongo] state=${map[s] ?? s}`);
}

async function connectMongo() {
  if (!MONGO_URI) {
    console.warn('⚠️ Skipping MongoDB connection: MONGO_URI is not set.');
    return false;
  }
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser:    true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: Number(process.env.MONGO_SSM || 15000),
      socketTimeoutMS: Number(process.env.MONGO_SOCK_TIMEOUT || 45000),
      maxPoolSize: Number(process.env.MONGO_MAX_POOL || 10),
      retryWrites: true,
    });
    const { host, port, name } = mongoose.connection;
    console.log(`✅ MongoDB connected → ${host}:${port}/${name}`);
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err?.message || err);
    return false;
  }
}

if (!IS_TEST) {
  connectMongo().then((ok) => {
    if (!ok) {
      console.warn('⚠️ DB-backed endpoints will return 503 until Mongo connects.');
    }
    logConnState();
  });
} else {
  console.log('ℹ️ Test mode: skipping MongoDB connection.');
}

mongoose.connection.on('connected', () => console.log('✅ Mongo connected'));
mongoose.connection.on('disconnected', () => console.warn('⚠️ Mongo disconnected'));
mongoose.connection.on('error', (e) => console.error('❌ Mongo error:', e?.message || e));

// ──────────────────────────────────────────────────────────────────────────────
/* CORS & Preflight */
// ──────────────────────────────────────────────────────────────────────────────
app.use(corsConfig);
app.options('/api/auth/refresh', corsConfig, (req, res) => res.sendStatus(200));
app.options(
  '/api/users/:userId/photos/upload-photo-step',
  corsConfig,
  (req, res) => res.sendStatus(200)
);
// broaden preflight for auth + legacy root endpoints
app.options(
  ['/api/auth/*', '/register', '/login', '/logout', '/refresh', '/me', '/profile'],
  corsConfig,
  (req, res) => res.sendStatus(200)
);

// ──────────────────────────────────────────────────────────────────────────────
/* Security headers */
// ──────────────────────────────────────────────────────────────────────────────
app.use(securityHeaders);

// ──────────────────────────────────────────────────────────────────────────────
/* Cookies */
// ──────────────────────────────────────────────────────────────────────────────
let cookieOptions;
try {
  ({ cookieOptions } = require('./src/utils/cookieOptions.js'));
} catch (_) {
  try {
    ({ cookieOptions } = require('./utils/cookieOptions.js'));
  } catch (_e) {
    cookieOptions = { httpOnly: true, sameSite: 'lax', secure: IS_PROD };
  }
}
app.set('trust proxy', 1);
app.use(cookieParser());

// ──────────────────────────────────────────────────────────────────────────────
/* HTTPS redirect in production (behind feature flag) */
// ──────────────────────────────────────────────────────────────────────────────
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';
if (IS_PROD && FORCE_HTTPS) {
  try {
    app.use(require('./middleware/httpsRedirect.js'));
  } catch(_) {
    // Optional middleware
  }
}

// ──────────────────────────────────────────────────────────────────────────────
/* Webhooks — Stripe BEFORE body parsers (raw body required) */
// ──────────────────────────────────────────────────────────────────────────────
if (!IS_TEST) {
  try {
    // Router defines: POST /payment/stripe-webhook (express.raw)
    const stripeWebhookRouter = require('./routes/stripeWebhook.js');
    // Mount at '/api' so final path is /api/payment/stripe-webhook
    app.use('/api', stripeWebhookRouter);
    console.log('💳 Mounted Stripe webhook at /api/payment/stripe-webhook (pre-body-parser)');
  } catch (e) {
    console.warn('⚠️ Stripe webhook route not mounted:', e && e.message ? e.message : e);
  }
} else {
  console.log('ℹ️ Test mode: skipping Stripe webhook mount.');
}

// ──────────────────────────────────────────────────────────────────────────────
/* Body parsers */
// ──────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb', strict: true, type: 'application/json' }));
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────────────────────────────────────────
/* Sanitizers */
// ──────────────────────────────────────────────────────────────────────────────
app.use(xssSanitizer);
app.use(sqlSanitizer);

// ──────────────────────────────────────────────────────────────────────────────
/* DB readiness guard */
// ──────────────────────────────────────────────────────────────────────────────
function dbReady(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({ error: 'Database not connected. Please try again shortly.' });
}

// ──────────────────────────────────────────────────────────────────────────────
/* Diagnostics & internal utilities */
// ──────────────────────────────────────────────────────────────────────────────
app.get('/healthcheck', (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    requestId: req.id,
    env: process.env.NODE_ENV || 'development',
  });
});

app.get('/test-alerts', async (req, res) => {
  try {
    await checkThreshold('Error Rate', 100, Number(process.env.ERROR_RATE_THRESHOLD));
    res.send('Alerts triggered');
  } catch (e) {
    res.status(500).send('Alert test failed');
  }
});

// ──────────────────────────────────────────────────────────────────────────────
/* Webhook routes (legacy/paypal) — AFTER parsers (no raw body needed) */
// ──────────────────────────────────────────────────────────────────────────────
if (!IS_TEST) {
  try {
    const paypalWebhookRouter = require('./routes/paypalWebhook.js');
    app.use('/api/payment/paypal-webhook', paypalWebhookRouter);
  } catch(_) {
    // optional
  }
} else {
  console.log('ℹ️ Test mode: skipping webhook route mounts.');
}

// ──────────────────────────────────────────────────────────────────────────────
/* Static content (uploads + optional client build) */
// ──────────────────────────────────────────────────────────────────────────────
const uploadsRoot = path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
  for (const sub of ['avatars', 'extra']) {
    const subDir = path.join(uploadsRoot, sub);
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
  }
} catch (e) {
  console.warn('⚠️ Could not ensure /uploads directory tree:', e && e.message ? e.message : e);
}

app.use(
  '/uploads',
  express.static(uploadsRoot, {
    fallthrough: false,
    index: false,
    maxAge: 0,
    setHeaders(res) {
      // Ensure assets are viewable cross-origin (e.g., from Vite dev server)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    },
  })
);

// Optionally serve client build (controlled by env; harmless if not present)
if (process.env.SERVE_CLIENT === 'true') {
  const candidates = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
    path.resolve(__dirname, '../../public'),
  ];
  let staticDir = null;
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        staticDir = c;
        break;
      }
    } catch {}
  }
  if (staticDir) {
    console.log('📦 Serving client from:', staticDir);
    app.use(express.static(staticDir));
    // SPA fallback
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
/* Helper to try src route first, then fallback */
// ──────────────────────────────────────────────────────────────────────────────
function tryRequireRoute(primary, ...candidates) {
  const attempts = [primary, ...candidates];
  for (const p of attempts) {
    try {
      return require(p);
    } catch (_) {
      // keep trying
    }
  }
  const list = attempts.map((p) => ` - ${p}`).join('\n');
  const err = new Error(`Route import failed. Tried:\n${list}`);
  throw err;
}

// ──────────────────────────────────────────────────────────────────────────────
/* Health routes (alias endpoints for LB/proxy checks) */
// ──────────────────────────────────────────────────────────────────────────────
try {
  const healthRoute = require('./routes/health.js');
  app.use('/api/health', healthRoute);
  app.use('/api/healthz', healthRoute); // alias
  app.use('/api/_health', healthRoute); // extra alias for older infra
} catch(_) {
  // If health route missing, keep the /healthcheck basic endpoint above
}

// ──────────────────────────────────────────────────────────────────────────────
/* Auth routes */
// ──────────────────────────────────────────────────────────────────────────────
if (IS_TEST) {
  // Minimal JWT auth for tests
  const jwt = require('jsonwebtoken');
  const testAuth = express.Router();

  const TEST_JWT_SECRET     = process.env.JWT_SECRET || 'test_secret';
  const TEST_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret';
  const noValidate = (req, _res, next) => next();

  // Login: return accessToken and set refresh cookie
  testAuth.post('/login', noValidate, (req, res) => {
    const { email } = req.body || {};
    const userId = '000000000000000000000001';
    const role = 'user';

    const accessToken = jwt.sign(
      { id: userId, userId, role, email },
      TEST_JWT_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { id: userId, userId, role },
      TEST_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ accessToken });
  });

  // Refresh: verify cookie and issue new access token
  testAuth.post('/refresh', (req, res) => {
    const token = req.cookies && req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token provided' });

    try {
      const payload = jwt.verify(token, TEST_REFRESH_SECRET);
      const accessToken = jwt.sign(
        { id: payload.userId || payload.id, userId: payload.userId || payload.id, role: payload.role },
        TEST_JWT_SECRET,
        { expiresIn: '15m' }
      );
      return res.json({ accessToken });
    } catch {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
  });

  // Logout: clear cookie
  testAuth.post('/logout', (_req, res) => {
    res.clearCookie('refreshToken', cookieOptions);
    return res.json({ message: 'Logout successful' });
  });

  app.use('/api/auth', testAuth);

} else {
  // Production/Dev auth endpoints (direct handlers to guarantee availability)
  if (authController && typeof authController.login === 'function') {
    app.post(
      '/api/auth/login',
      dbReady, // ensure DB is connected before hitting controller
      loginSchema ? validateBody(loginSchema) : (req, _res, next) => next(),
      authController.login
    );
  }

  if (authController && typeof authController.register === 'function') {
    app.post(
      '/api/auth/register',
      dbReady,
      registerSchema ? validateBody(registerSchema) : (req, _res, next) => next(),
      authController.register
    );
  }

  // Mount router module: prefer src/routes/authRoutes.js, then routes/authRoutes.js, then routes/auth.js
  const authRoutes = tryRequireRoute(
    './src/routes/authRoutes.js',
    './routes/authRoutes.js',
    path.resolve(__dirname, '../routes/authRoutes.js'),
    './routes/auth.js',
    path.resolve(__dirname, '../routes/auth.js')
  );
  app.use('/api/auth', authRoutes);
}

// ──────────────────────────────────────────────────────────────────────────────
/* Legacy root aliases that forward to /api/auth/* + /api/users/* */
// ──────────────────────────────────────────────────────────────────────────────
const alias = express.Router();

// Auth root → /api/auth
alias.post('/register', (req, _res, next) => { req.url = '/api/auth/register'; return next(); });
alias.post('/login',    (req, _res, next) => { req.url = '/api/auth/login';    return next(); });
alias.post('/logout',   (req, _res, next) => { req.url = '/api/auth/logout';   return next(); });
alias.post('/refresh',  (req, _res, next) => { req.url = '/api/auth/refresh';  return next(); });

// Users/profile root → /api/users
alias.get('/me',        (req, _res, next) => { req.url = '/api/users/me';      return next(); });
alias.get('/profile',   (req, _res, next) => { req.url = '/api/users/profile'; return next(); });
alias.put('/profile',   (req, _res, next) => { req.url = '/api/users/profile'; return next(); });

app.use(alias);

// ──────────────────────────────────────────────────────────────────────────────
/* Feature routes (non-test) */
// ──────────────────────────────────────────────────────────────────────────────
if (!IS_TEST) {
  // Users
  try {
    const userRoutes = tryRequireRoute(
      './routes/userRoutes.js',                 // preferred modern router
      './src/routes/userRoutes.js',
      path.resolve(__dirname, '../routes/userRoutes.js')
    );
    // IMPORTANT — do NOT mount legacy ./routes/user.js to avoid duplicates
    try {
      require.resolve('./routes/user.js');
      console.warn('⚠️ Legacy routes/user.js detected but NOT mounted to avoid duplicate endpoints.');
    } catch {}
    // Mount the modern users router only (guarded by dbReady + auth)
    app.use('/api/users', dbReady, authenticate, authorizeRoles('admin', 'user'), userRoutes);
  } catch(_) {
    // optional feature
  }

  // Messages
  try {
    const messageRoutes = tryRequireRoute(
      './routes/messageRoutes.js',
      './routes/message.js',
      path.resolve(__dirname, '../routes/messageRoutes.js')
    );
    app.use('/api/messages', authenticate, authorizeRoles('user'), messageRoutes);
  } catch (_) {
    // optional feature
  }

  // Payments
  try {
    const paymentRoutes = tryRequireRoute(
      './routes/paymentRoutes.js',
      './routes/payment.js',
      path.resolve(__dirname, '../routes/paymentRoutes.js')
    );
    app.use('/api/payment', authenticate, authorizeRoles('user'), paymentRoutes);
  } catch (_) {
    // optional
  }

  // Billing (Stripe Checkout/Portal/Synchronization)
  try {
    const billingRoutes = tryRequireRoute(
      './routes/billing.js',
      './src/routes/billing.js',
      path.resolve(__dirname, '../routes/billing.js')
    );
    // Require auth for billing ops; DB must be ready for user lookups/updates
    app.use('/api/billing', dbReady, authenticate, authorizeRoles('user'), billingRoutes);
    console.log('🧾 Mounted /api/billing routes');
  } catch (e) {
    console.warn('⚠️ /api/billing not mounted (missing file or bad export):', e && e.message ? e.message : e);
  }

  // Admin
  try {
    const adminRoutes = tryRequireRoute(
      './routes/adminRoutes.js',
      './routes/admin.js',
      path.resolve(__dirname, '../routes/adminRoutes.js')
    );
    app.use('/api/admin', authenticate, authorizeRoles('admin'), adminRoutes);
  } catch (_) {
    // optional
  }

  // Discover
  try {
    const discoverRoutes = tryRequireRoute(
      './routes/discoverRoutes.js',
      './routes/discover.js',
      path.resolve(__dirname, '../routes/discoverRoutes.js')
    );
    app.use('/api/discover', authenticate, authorizeRoles('user'), discoverRoutes);
  } catch (_) {
    // optional
  }

  // Likes (standard likes; server may enforce daily cap for non-premium)
  try {
    const likesRoutes = tryRequireRoute(
      './routes/likes.js',
      './src/routes/likes.js',
      path.resolve(__dirname, '../routes/likes.js')
    );
    app.use('/api/likes', authenticate, authorizeRoles('user'), likesRoutes);
  } catch(_) {
    // optional
  }

  // Super Likes (feature-gated; client will block if no quota or not entitled)
  try {
    const superlikesRoutes = tryRequireRoute(
      './routes/superlikes.js',
      './src/routes/superlikes.js',
      path.resolve(__dirname, '../routes/superlikes.js')
    );
    app.use('/api/superlikes', authenticate, authorizeRoles('user'), superlikesRoutes);
  } catch(_) {
    // optional
  }

  // Rewind (premium unlimited; non-premium limited/none)
  try {
    const rewindRoutes = tryRequireRoute(
      './routes/rewind.js',
      './src/routes/rewind.js',
      path.resolve(__dirname, '../routes/rewind.js')
    );
    app.use('/api/rewind', authenticate, authorizeRoles('user'), rewindRoutes);
  } catch(_) {
    // optional
  }

  // Search / Discover query builder (dealbreakers premium-only)
  try {
    const searchRoutes = tryRequireRoute(
      './routes/search.js',
      './src/routes/search.js',
      path.resolve(__dirname, '../routes/search.js')
    );
    app.use('/api/search', authenticate, authorizeRoles('user'), searchRoutes);
  } catch(_) {
    // optional
  }

  // Notifications (ESM/CJS compatibility)
  (async () => {
    try {
      const candidates = [
        path.resolve(__dirname, './routes/notifications.js'),
        path.resolve(__dirname, './src/routes/notifications.js'),
        path.resolve(__dirname, '../routes/notifications.js'),
      ];
      let notificationsRouter = null;

      for (const p of candidates) {
        try {
          // Try require first (works if CJS)
          let mod = require(p);
          notificationsRouter = mod && (mod.default || mod.router || mod);
          if (notificationsRouter) break;
        } catch (err) {
          // Fallback to ESM dynamic import on ERR_REQUIRE_ESM or general import error
          try {
            const esm = await import(pathToFileURL(p).href);
            notificationsRouter = esm && (esm.default || esm.router || esm);
            if (notificationsRouter) break;
          } catch {
            // try next candidate
          }
        }
      }

      if (notificationsRouter && typeof notificationsRouter === 'function') {
        app.use('/api/notifications', authenticate, notificationsRouter);
        console.log('🔔 Mounted /api/notifications');
      } else {
        console.warn('⚠️ Notifications route not mounted (file missing or invalid export).');
      }
    } catch (e) {
      console.warn('⚠️ Failed to mount /api/notifications:', e && e.message ? e.message : e);
    }
  })();
}

// ──────────────────────────────────────────────────────────────────────────────
/* Temporary mock users endpoint (kept for backward compatibility) */
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  res.json([]);
});

// ──────────────────────────────────────────────────────────────────────────────
/* Multer error handler (payload too large / field limits) */
// ──────────────────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  return next(err);
});

// ──────────────────────────────────────────────────────────────────────────────
/* 404 handler */
// ──────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ──────────────────────────────────────────────────────────────────────────────
/* Global error handler */
// ──────────────────────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const requestId = req.id || 'n/a';
  console.error(`[${requestId}]`, err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Server Error', requestId });
});

// ──────────────────────────────────────────────────────────────────────────────
/* SOCKET.IO INTEGRATION + server start (skipped in tests) */
// ──────────────────────────────────────────────────────────────────────────────
let httpServer = null;
const PORT = process.env.PORT || 5000;

if (!IS_TEST) {
  try {
    const { initializeSocket } = require('./socket.js');
    httpServer = initializeSocket(app);
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server + Socket.io running on port ${PORT}`);
    });
  } catch(_) {
    // Fallback: run pure Express if socket.js missing
    httpServer = require('http').createServer(app);
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  }
} else {
  console.log('ℹ️ Test mode: HTTP server is not started.');
}

// ──────────────────────────────────────────────────────────────────────────────
/* Graceful shutdown (SIGINT/SIGTERM) */
// ──────────────────────────────────────────────────────────────────────────────
async function shutdown(signal) {
  try {
    console.log(`\n${signal} received: closing server...`);
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    console.log('✅ Shutdown complete.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error during shutdown:', e);
    process.exit(1);
  }
}
if (!IS_TEST) {
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
