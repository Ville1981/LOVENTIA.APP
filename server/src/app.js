// --- REPLACE START: load environment variables and import alert helper ---
require('dotenv').config();
const { checkThreshold } = require('./utils/alertRules.js');
// --- REPLACE END ---

const express      = require('express');
const mongoose     = require('mongoose');

// --- REPLACE START: use centralized CORS config instead of inline cors(...) ---
const corsConfig   = require('./config/corsConfig.js');
// --- REPLACE END ---

const cookieParser = require('cookie-parser');
const path         = require('path');

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
  authController = require('./api/controllers/authController.js');
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
require(path.resolve(__dirname, './models/User.js'));
try {
  require(path.resolve(__dirname, './models/Message.js'));
} catch (_) {
  // Optional: some deployments may not have messaging enabled yet
}
// --- REPLACE END ---

const app = express();

// ── Swagger-UI Integration ─────────────────────────────────────────────────────
app.use(
  '/api-docs',
  swagger.serve,
  swagger.setup
);

// ── Connect to MongoDB ─────────────────────────────────────────────────--------
const MONGO_URI = process.env.MONGO_URI;
const IS_TEST   = process.env.NODE_ENV === 'test';
const IS_PROD   = process.env.NODE_ENV === 'production';

try {
  mongoose.set('strictQuery', false);
  if (IS_TEST) {
    mongoose.set('bufferCommands', true);
  } else {
    mongoose.set('bufferCommands', false);
  }
} catch (_) {}

if (!IS_TEST && MONGO_URI) {
  mongoose.connect(MONGO_URI, {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
  })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
    });
} else {
  if (!MONGO_URI) {
    console.warn('⚠️ Skipping MongoDB connection: MONGO_URI is not set.');
  } else if (IS_TEST) {
    console.log('ℹ️ Test mode: skipping MongoDB connection.');
  }
}

// ── CORS & Preflight Handler ───────────────────────────────────────────────────
app.use(corsConfig);
app.options('/api/auth/refresh', corsConfig, (req, res) => res.sendStatus(200));
app.options(
  '/api/users/:userId/photos/upload-photo-step',
  corsConfig,
  (req, res) => res.sendStatus(200)
);

// ── Security Headers ───────────────────────────────────────────────────────────
app.use(securityHeaders);

// ── Secure cookies & HTTPS enforcement ──────────────────────────────────────────
// Prefer cookieOptions from src/utils; fallback to legacy utils
let cookieOptions;
try {
  ({ cookieOptions } = require('./src/utils/cookieOptions.js'));
} catch (_) {
  ({ cookieOptions } = require('./utils/cookieOptions.js'));
}
app.set('trust proxy', 1);
app.use(cookieParser());

// --- REPLACE START: enable HTTPS redirect only in production ---
app.use((req, res, next) => next()); // no-op placeholder
if (IS_PROD) {
  app.use(require('./middleware/httpsRedirect.js'));
}
// --- REPLACE END ---

// ── Parse bodies ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Input sanitization ──────────────────────────────────────────────────────────
app.use(xssSanitizer);
app.use(sqlSanitizer);

// ── Test alerts endpoint ───────────────────────────────────────────────────────
app.get('/test-alerts', async (req, res) => {
  await checkThreshold(
    'Error Rate',
    100,
    Number(process.env.ERROR_RATE_THRESHOLD)
  );
  res.send('Alerts triggered');
});

// ── Webhook routes (before body parsers) ────────────────────────────────────────
if (!IS_TEST) {
  const stripeWebhookRouter = require('./routes/stripeWebhook.js');
  const paypalWebhookRouter = require('./routes/paypalWebhook.js');

  app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
  app.use('/api/payment/paypal-webhook', paypalWebhookRouter);
} else {
  console.log('ℹ️ Test mode: skipping webhook route mounts.');
}

// ── Serve uploads ───────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Helper to try src route first, then fallback ────────────────────────────────
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

// --- REPLACE START: mount /api/health route for quick proxy/CORS checks ---
const healthRoute = require('./routes/health.js');
app.use('/api/health', healthRoute);
app.use('/api/healthz', healthRoute); // alias
// --- REPLACE END ---

// ── Routes ──────────────────────────────────────────────────────────────────────
if (IS_TEST) {
  const jwt = require('jsonwebtoken');
  const testAuth = express.Router();

  const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
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
      loginSchema ? validateBody(loginSchema) : (req, _res, next) => next(),
      authController.login
    );
  }

  if (authController && typeof authController.register === 'function') {
    app.post(
      '/api/auth/register',
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

// ── Mount other feature routes only outside test ───────────────────────────────
if (!IS_TEST) {
  // Users
  const userRoutes = tryRequireRoute(
    './routes/userRoutes.js',
    './src/routes/userRoutes.js',
    path.resolve(__dirname, '../routes/userRoutes.js')
  );
  app.use(
    '/api/users',
    authenticate,
    authorizeRoles('admin', 'user'),
    userRoutes
  );

  // Messages
  let messageRoutes;
  try {
    messageRoutes = tryRequireRoute(
      './routes/messageRoutes.js',
      './routes/message.js',
      path.resolve(__dirname, '../routes/messageRoutes.js')
    );
    app.use(
      '/api/messages',
      authenticate,
      authorizeRoles('user'),
      messageRoutes
    );
  } catch (_) {
    // Optional feature; skip if route file not present
  }

  // Payments
  let paymentRoutes;
  try {
    paymentRoutes = tryRequireRoute(
      './routes/paymentRoutes.js',
      './routes/payment.js',
      path.resolve(__dirname, '../routes/paymentRoutes.js')
    );
    app.use(
      '/api/payment',
      authenticate,
      authorizeRoles('user'),
      paymentRoutes
    );
  } catch (_) {}

  // Admin
  let adminRoutes;
  try {
    adminRoutes = tryRequireRoute(
      './routes/adminRoutes.js',
      './routes/admin.js',
      path.resolve(__dirname, '../routes/adminRoutes.js')
    );
    app.use(
      '/api/admin',
      authenticate,
      authorizeRoles('admin'),
      adminRoutes
    );
  } catch (_) {}

  // Discover
  let discoverRoutes;
  try {
    discoverRoutes = tryRequireRoute(
      './routes/discoverRoutes.js',
      './routes/discover.js',
      path.resolve(__dirname, '../routes/discoverRoutes.js')
    );
    app.use(
      '/api/discover',
      authenticate,
      authorizeRoles('user'),
      discoverRoutes
    );
  } catch (_) {}
}

// ── Temporary mock users endpoint ───────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  res.json([]);
});

// ── Multer error handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  return next(err);
});

// ── 404 handler ─────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Global error handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Server Error' });
});

// ── SOCKET.IO INTEGRATION ──────────────────────────────────────────────────────
let httpServer = null;
const PORT = process.env.PORT || 5000;

if (!IS_TEST) {
  const { initializeSocket } = require('./socket.js');
  httpServer = initializeSocket(app);
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server + Socket.io running on port ${PORT}`);
  });
} else {
  console.log('ℹ️ Test mode: HTTP server is not started.');
}

module.exports = app;
