// File: server/src/app.js

// --- REPLACE START: load environment variables and import alert helper ---
require('dotenv').config();
const { checkThreshold } = require('./utils/alertRules');
// --- REPLACE END ---

const express      = require('express');
const mongoose     = require('mongoose');

// --- REPLACE START: use centralized CORS config instead of inline cors(...) ---
const corsConfig   = require('../config/corsConfig');
// --- REPLACE END ---

const cookieParser = require('cookie-parser');
const path         = require('path');

// --- REPLACE START: import security headers middleware ---
const securityHeaders = require('./utils/securityHeaders');
// --- REPLACE END ---

// --- REPLACE START: import centralized Swagger config ---
const swagger = require('./swagger-config');
// --- REPLACE END ---

// --- REPLACE START: import XSS & SQL sanitizers ---
const xssSanitizer = require('../middleware/xssSanitizer');
const sqlSanitizer = require('../middleware/sqlSanitizer');
// --- REPLACE END ---

// --- REPLACE START: import request validators & schemas ---
const { validateBody }                = require('../middleware/validateRequest');
const { loginSchema, registerSchema } = require('./validators/authValidator');

// *** FIXED PATH ***
// The replacement region is marked below so you can see exactly what changed.
//// old: const authController = require('./controllers/authController');
// --- REPLACE START: point to api/controllers/authController ---
const authController                  = require('./api/controllers/authController');
// --- REPLACE END ---

// If you expose registration in your controller, keep it imported above.
// --- REPLACE END ---

// --- REPLACE START: import auth check & role-based authorization ---
const authenticate   = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/roleAuthorization');
// --- REPLACE END ---

// Ensure models are registered before middleware/routes
// --- REPLACE START: fix model import paths to actual location in server/models ---
require(path.resolve(__dirname, '../models/User.js'));
require(path.resolve(__dirname, '../models/Message.js'));
// --- REPLACE END ---

const app = express();

// ── Swagger-UI Integration ─────────────────────────────────────────────────────
// (serve at GET /api-docs)
// --- REPLACE START: serve Swagger UI ---
app.use(
  '/api-docs',
  swagger.serve,
  swagger.setup
);
// --- REPLACE END ---

// ── Connect to MongoDB ─────────────────────────────────────────────────────────
// --- REPLACE START: skip DB connect during tests and when MONGO_URI missing ---
const MONGO_URI = process.env.MONGO_URI;
const IS_TEST   = process.env.NODE_ENV === 'test';

if (!IS_TEST && MONGO_URI) {
  mongoose.connect(MONGO_URI, {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
  })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      // process.exit(1); // avoid exiting hard
    });
} else {
  try { mongoose.set('bufferCommands', false); } catch (_) {}
  if (!MONGO_URI) {
    console.warn('⚠️ Skipping MongoDB connection: MONGO_URI is not set.');
  } else if (IS_TEST) {
    console.log('ℹ️ Test mode: skipping MongoDB connection.');
  }
}
// --- REPLACE END ---

// ── CORS & Preflight Handler ───────────────────────────────────────────────────
// --- REPLACE START: apply centralized CORS config ---
app.use(corsConfig);
// --- REPLACE END ---

// --- REPLACE START: add CORS preflight for refresh token endpoint ---
app.options('/api/auth/refresh', corsConfig, (req, res) => res.sendStatus(200));
// --- REPLACE END ---

app.options(
  '/api/users/:userId/photos/upload-photo-step',
  corsConfig,
  (req, res) => res.sendStatus(200)
);

// ── Security Headers ───────────────────────────────────────────────────────────
app.use(securityHeaders);

// ── Secure cookies & HTTPS enforcement ──────────────────────────────────────────
// --- REPLACE START: secure cookies & HTTPS enforcement using centralized cookieOptions ---
const { cookieOptions } = require('./utils/cookieOptions');
app.set('trust proxy', 1);
app.use(cookieParser()); // parses cookies
app.use((req, res, next) => {
  // ensure refreshToken cookie settings are applied in authController
  next();
});
app.use(require('../middleware/httpsRedirect'));
// --- REPLACE END ---

// ── Parse bodies ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Input sanitization ──────────────────────────────────────────────────────────
// --- REPLACE START: apply XSS & SQL sanitizers ---
app.use(xssSanitizer);
app.use(sqlSanitizer);
// --- REPLACE END ---

// ── Test alerts endpoint ─────────────────────────────────────────────────────────
// --- REPLACE START: test-alerts route ---
app.get('/test-alerts', async (req, res) => {
  await checkThreshold(
    'Error Rate',
    100,
    Number(process.env.ERROR_RATE_THRESHOLD)
  );
  res.send('Alerts triggered');
});
// --- REPLACE END ---

// ── Webhook routes (before body parsers) ────────────────────────────────────────
// --- REPLACE START: conditionally mount webhook routes only outside test env ---
if (!IS_TEST) {
  const stripeWebhookRouter = require('../routes/stripeWebhook');
  const paypalWebhookRouter = require('../routes/paypalWebhook');

  app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
  app.use('/api/payment/paypal-webhook', paypalWebhookRouter);
} else {
  console.log('ℹ️ Test mode: skipping webhook route mounts.');
}
// --- REPLACE END ---

// ── Serve uploads ───────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Auth endpoints with validation ──────────────────────────────────────────────
// NOTE: If you support registration, keep register route. If not, you can disable it later.
// --- REPLACE START: apply request validators for login (& optional register) ---
app.post(
  '/api/auth/login',
  validateBody(loginSchema),
  authController.login
);

if (authController.register && registerSchema) {
  app.post(
    '/api/auth/register',
    validateBody(registerSchema),
    authController.register
  );
}
// --- REPLACE END ---

// ── Mount public auth routes ───────────────────────────────────────────────────
// --- REPLACE START: try src/routes first, fallback to server/routes ---
function tryRequireRoute(srcPath, fallbackAbsPath) {
  try {
    return require(srcPath);
  } catch (e1) {
    try {
      return require(fallbackAbsPath);
    } catch (e2) {
      e2.message = `Route import failed. Tried:\n - ${srcPath}\n - ${fallbackAbsPath}\nOriginal: ${e2.message}`;
      throw e2;
    }
  }
}

const authRoutes = tryRequireRoute(
  './routes/authRoutes',
  path.resolve(__dirname, '../routes/authRoutes.js')
);
app.use('/api/auth', authRoutes);
// --- REPLACE END ---

// ── Protected user routes (admin + user) ───────────────────────────────────────
// --- REPLACE START: try src/routes first, fallback to server/routes ---
const userRoutes = tryRequireRoute(
  './routes/user',
  path.resolve(__dirname, '../routes/user.js')
);
app.use(
  '/api/users',
  authenticate,
  authorizeRoles('admin', 'user'),
  userRoutes
);
// --- REPLACE END ---

// ── Protected message routes (user only) ───────────────────────────────────────
// --- REPLACE START: try src/routes first, fallback to server/routes ---
const messageRoutes = tryRequireRoute(
  './routes/message',
  path.resolve(__dirname, '../routes/message.js')
);
app.use(
  '/api/messages',
  authenticate,
  authorizeRoles('user'),
  messageRoutes
);
// --- REPLACE END ---

// ── Protected payment routes (user only) ───────────────────────────────────────
// --- REPLACE START: try src/routes first, fallback to server/routes ---
const paymentRoutes = tryRequireRoute(
  './routes/payment',
  path.resolve(__dirname, '../routes/payment.js')
);
app.use(
  '/api/payment',
  authenticate,
  authorizeRoles('user'),
  paymentRoutes
);
// --- REPLACE END ---

// ── Admin-only routes ──────────────────────────────────────────────────────────
// --- REPLACE START: try src/routes first, fallback to server/routes ---
const adminRoutes = tryRequireRoute(
  './routes/admin',
  path.resolve(__dirname, '../routes/admin.js')
);
app.use(
  '/api/admin',
  authenticate,
  authorizeRoles('admin'),
  adminRoutes
);
// --- REPLACE END ---

// ── Protected discover routes (user only) ──────────────────────────────────────
// --- REPLACE START: try src/routes first, fallback to server/routes ---
const discoverRoutes = tryRequireRoute(
  './routes/discover',
  path.resolve(__dirname, '../routes/discover.js')
);
app.use(
  '/api/discover',
  authenticate,
  authorizeRoles('user'),
  discoverRoutes
);
// --- REPLACE END ---

// ── Temporary mock users endpoint ────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  // …unchanged mock data…
  res.json([/* … */]);
});

// ── Multer error handler ─────────────────────────────────────────────────────────
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
const { initializeSocket } = require('./socket');
const httpServer           = initializeSocket(app);
const PORT                 = process.env.PORT || 5000;

// --- REPLACE START: do not start HTTP server during tests ---
if (!IS_TEST) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server + Socket.io running on port ${PORT}`);
  });
} else {
  console.log('ℹ️ Test mode: HTTP server is not started.');
}
// --- REPLACE END ---

module.exports = app;
