// --- REPLACE START: load environment variables and import alert helper ---
require('dotenv').config();
const { checkThreshold } = require('./utils/alertRules.js');
// --- REPLACE END ---

const express       = require('express');
const mongoose      = require('mongoose');
const cookieParser  = require('cookie-parser');
const path          = require('path');

// --- REPLACE START: add fs for uploads dir ensure ---
const fs            = require('fs');
// --- REPLACE END ---

// Optional-but-useful middlewares (safe, non-breaking)
const morgan        = require('morgan');
const compression   = require('compression');
const responseTime  = require('response-time');
const { v4: uuidv4} = require('uuid');

// --- REPLACE START: use centralized CORS config instead of inline cors(...) ---
const corsConfig    = require('./config/corsConfig.js');
// --- REPLACE END ---

// --- REPLACE START: import security headers middleware ---
const securityHeaders = require('./utils/securityHeaders.js');
// --- REPLACE END ---

// --- REPLACE START: import centralized Swagger config ---
const swagger = require('./swagger-config.js');
// --- REPLACE END ---

// --- REPLACE START: import XSS & SQL sanitizers ---
const xssSanitizer = require('./middleware/xssSanitizer.js');
const sqlSanitizer = require('./middleware/sqlSanitizer.js');
// --- REPLACE END ---

// --- REPLACE START: import request validators & schemas ---
const { validateBody } = require('./middleware/validateRequest.js');
// Prefer validators from src if present, else fallback to legacy location
let loginSchema, registerSchema;
try {
  ({ loginSchema, registerSchema } = require('./src/api/validators/authValidator.js'));
} catch (_) {
  try {
    ({ loginSchema, registerSchema } = require('./validators/authValidator.js'));
  } catch (_e) {
    // Schemas optional; /api/auth/login & /api/auth/register will still work without them.
  }
}
// --- REPLACE END ---

// *** FIXED PATH ***
// --- REPLACE START: point to api/controllers/authController (prefer src, fallback legacy) ---
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
// --- REPLACE END ---

// --- REPLACE START: import auth check & role-based authorization ---
const authorizeRoles = require('./middleware/roleAuthorization.js');
const { pathToFileURL } = require('url');

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
// --- REPLACE END ---

// --- REPLACE START: fix model import paths to actual location in ./models ---
try { require(path.resolve(__dirname, './models/User.js')); } catch(_) {}
try { require(path.resolve(__dirname, './models/Message.js')); } catch (_) {}
try { require(path.resolve(__dirname, './models/Payment.js')); } catch (_) {}
// --- REPLACE END ---

const app = express();

/* ──────────────────────────────────────────────────────────────────────────────
   App-level telemetry & utilities (non-breaking)
────────────────────────────────────────────────────────────────────────────── */
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_PROD = process.env.NODE_ENV === 'production';
const IS_DEV  = !IS_TEST && !IS_PROD;

// === i18n locales static (optional) ===
// Serve /locales when USE_SERVER_LOCALES=true (client can also serve locales from its own public/ folder)
if (process.env.USE_SERVER_LOCALES === 'true') {
  app.use(
    '/locales',
    express.static(path.join(process.cwd(), 'public', 'locales'), {
      fallthrough: false,
      index: false,
      maxAge: 0
    })
  );
  console.log('[i18n] Serving locales from server at /locales');
}
// === end locales static ===

// Attach a request-id for correlation
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

/* ──────────────────────────────────────────────────────────────────────────────
   Swagger-UI Integration
────────────────────────────────────────────────────────────────────────────── */
app.use('/api-docs', swagger.serve, swagger.setup);

/* ──────────────────────────────────────────────────────────────────────────────
   MongoDB connection
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: robust Mongo setup (disable buffering + helper connect) ---
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
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   CORS & Preflight Handler
────────────────────────────────────────────────────────────────────────────── */
app.use(corsConfig);
app.options('/api/auth/refresh', corsConfig, (req, res) => res.sendStatus(200));
app.options(
  '/api/users/:userId/photos/upload-photo-step',
  corsConfig,
  (req, res) => res.sendStatus(200)
);

// --- REPLACE START: broaden preflight for auth + legacy root endpoints ---
app.options(['/api/auth/*', '/register', '/login', '/logout', '/refresh', '/me', '/profile'], corsConfig, (req, res) =>
  res.sendStatus(200)
);
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Security Headers
────────────────────────────────────────────────────────────────────────────── */
app.use(securityHeaders);

/* ──────────────────────────────────────────────────────────────────────────────
   Cookies
────────────────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────────────────
   HTTPS redirect in production (kept behind feature flag)
────────────────────────────────────────────────────────────────────────────── */
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';
if (IS_PROD && FORCE_HTTPS) {
  try {
    app.use(require('./middleware/httpsRedirect.js'));
  } catch(_) {}
}

/* ──────────────────────────────────────────────────────────────────────────────
   Body parsers
────────────────────────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '1mb', strict: true, type: 'application/json' }));
app.use(express.urlencoded({ extended: true }));

/* ──────────────────────────────────────────────────────────────────────────────
   Sanitizers
────────────────────────────────────────────────────────────────────────────── */
app.use(xssSanitizer);
app.use(sqlSanitizer);

/* ──────────────────────────────────────────────────────────────────────────────
   DB readiness guard (prevents 500 if Mongo not connected)
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: dbReady middleware to guard DB-backed endpoints ---
function dbReady(req, res, next) {
  // 1 = connected
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({ error: 'Database not connected. Please try again shortly.' });
}
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Diagnostics & internal utilities
────────────────────────────────────────────────────────────────────────────── */
// Simple heartbeat that includes request-id (useful behind proxies)
app.get('/healthcheck', (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    requestId: req.id,
    env: process.env.NODE_ENV || 'development',
  });
});

// Test alerts endpoint
app.get('/test-alerts', async (req, res) => {
  try {
    await checkThreshold('Error Rate', 100, Number(process.env.ERROR_RATE_THRESHOLD));
    res.send('Alerts triggered');
  } catch (e) {
    res.status(500).send('Alert test failed');
  }
});

/* ──────────────────────────────────────────────────────────────────────────────
   Webhook routes (before body parsers if raw is needed)
────────────────────────────────────────────────────────────────────────────── */
if (!IS_TEST) {
  try {
    const stripeWebhookRouter = require('./routes/stripeWebhook.js');
    app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
  } catch(_) {}
  try {
    const paypalWebhookRouter = require('./routes/paypalWebhook.js');
    app.use('/api/payment/paypal-webhook', paypalWebhookRouter);
  } catch(_) {}
} else {
  console.log('ℹ️ Test mode: skipping webhook route mounts.');
}

/* ──────────────────────────────────────────────────────────────────────────────
   Static content (uploads + optional client build)
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: serve /uploads from project root (process.cwd()) with ensured subfolders & CORS headers ---
/**
 * Serve user-uploaded assets from a single, absolute root based on process.cwd().
 * CORS middleware runs BEFORE this block so responses inherit proper headers.
 * We also ensure common subfolders exist to avoid Multer ENOENT on first boot.
 */
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
    // Let browsers revalidate; adjust if you want stronger caching in prod
    maxAge: 0,
    setHeaders(res) {
      // Ensure assets are viewable cross-origin (e.g., from Vite dev server)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    },
  })
);
// --- REPLACE END ---

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
      if (require('fs').existsSync(c)) {
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

/* ──────────────────────────────────────────────────────────────────────────────
   Helper to try src route first, then fallback
────────────────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────────────────
   Health routes (alias endpoints for LB/proxy checks)
────────────────────────────────────────────────────────────────────────────── */
try {
  const healthRoute = require('./routes/health.js');
  app.use('/api/health', healthRoute);
  app.use('/api/healthz', healthRoute); // alias
  app.use('/api/_health', healthRoute); // extra alias for older infra
} catch(_) {
  // If health route missing, keep the /healthcheck basic endpoint above
}

/* ──────────────────────────────────────────────────────────────────────────────
   Auth routes
────────────────────────────────────────────────────────────────────────────── */
if (IS_TEST) {
  const jwt = require('jsonwebtoken');
  const testAuth = express.Router();

  const TEST_JWT_SECRET     = process.env.JWT_SECRET || 'test_secret';
  const TEST_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret';
  const noValidate = (req, _res, next) => next();

  // Login: return accessToken and set refresh cookie
  testAuth.post('/login', noValidate, (req, res) => {
    const { email } = req.body || {};
    const userId = '000000000000000000000001';
    const role = 'user'; // ✅ FIX: replaced erroneous "the role" with valid declaration

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
      dbReady, // --- ensure DB is connected before hitting controller ---
      loginSchema ? validateBody(loginSchema) : (req, _res, next) => next(),
      authController.login
    );
  }

  if (authController && typeof authController.register === 'function') {
    app.post(
      '/api/auth/register',
      dbReady, // --- ensure DB is connected before hitting controller ---
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

// --- REPLACE START: add legacy root aliases that forward to /api/auth/* + /api/users/* ---
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
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Feature routes (non-test)
────────────────────────────────────────────────────────────────────────────── */
if (!IS_TEST) {
  // Users
  try {
    const userRoutes = tryRequireRoute(
      './routes/userRoutes.js',                 // ✅ preferred modern ESM/CJS router
      './src/routes/userRoutes.js',
      path.resolve(__dirname, '../routes/userRoutes.js')
    );
    // --- REPLACE START: IMPORTANT — do NOT mount legacy ./routes/user.js to avoid duplicates ---
    // We intentionally DO NOT mount ./routes/user.js (legacy). If it exists, we warn once.
    try {
      require.resolve('./routes/user.js');
      console.warn('⚠️ Legacy routes/user.js detected but NOT mounted to avoid duplicate endpoints.');
    } catch {}
    // Mount the modern users router only (guarded by dbReady):
    app.use('/api/users', dbReady, authenticate, authorizeRoles('admin', 'user'), userRoutes);
    // --- REPLACE END ---
  } catch(_) {}

  // Messages
  try {
    const messageRoutes = tryRequireRoute(
      './routes/messageRoutes.js',
      './routes/message.js',
      path.resolve(__dirname, '../routes/messageRoutes.js')
    );
    app.use('/api/messages', authenticate, authorizeRoles('user'), messageRoutes);
  } catch (_) {
    // Optional feature; skip if route file not present
  }

  // Payments
  try {
    const paymentRoutes = tryRequireRoute(
      './routes/paymentRoutes.js',
      './routes/payment.js',
      path.resolve(__dirname, '../routes/paymentRoutes.js')
    );
    app.use('/api/payment', authenticate, authorizeRoles('user'), paymentRoutes);
  } catch (_) {}

  // Admin
  try {
    const adminRoutes = tryRequireRoute(
      './routes/adminRoutes.js',
      './routes/admin.js',
      path.resolve(__dirname, '../routes/adminRoutes.js')
    );
    app.use('/api/admin', authenticate, authorizeRoles('admin'), adminRoutes);
  } catch (_) {}

  // Discover
  try {
    const discoverRoutes = tryRequireRoute(
      './routes/discoverRoutes.js',
      './routes/discover.js',
      path.resolve(__dirname, '../routes/discoverRoutes.js')
    );
    app.use('/api/discover', authenticate, authorizeRoles('user'), discoverRoutes);
  } catch (_) {}

  // --- REPLACE START: mount /api/notifications with ESM/CJS compatibility ---
  (async () => {
    try {
      // Prefer ESM dynamic import (our notifications route is ESM)
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
  // --- REPLACE END: mount /api/notifications with ESM/CJS compatibility ---
}

/* ──────────────────────────────────────────────────────────────────────────────
   Temporary mock users endpoint (kept for backward compatibility)
────────────────────────────────────────────────────────────────────────────── */
app.get('/api/users', (req, res) => {
  res.json([]);
});

/* ──────────────────────────────────────────────────────────────────────────────
   Multer error handler (payload too large / field limits)
────────────────────────────────────────────────────────────────────────────── */
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  return next(err);
});

/* ──────────────────────────────────────────────────────────────────────────────
   404 handler
────────────────────────────────────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

/* ──────────────────────────────────────────────────────────────────────────────
   Global error handler
────────────────────────────────────────────────────────────────────────────── */
app.use((err, req, res, _next) => {
  const requestId = req.id || 'n/a';
  console.error(`[${requestId}]`, err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Server Error', requestId });
});

/* ──────────────────────────────────────────────────────────────────────────────
   SOCKET.IO INTEGRATION + server start (skipped in tests)
────────────────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────────────────
   Graceful shutdown (SIGINT/SIGTERM)
────────────────────────────────────────────────────────────────────────────── */
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
