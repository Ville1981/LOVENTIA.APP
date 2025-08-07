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
const { validateBody }               = require('../middleware/validateRequest');
const { loginSchema, registerSchema } = require('./validators/authValidator');
const { createUserSchema }            = require('../validators/userValidator');
const authController                  = require('../controllers/authController');
const userController                  = require('../controllers/userController');
// --- REPLACE END ---

// --- REPLACE START: import auth check & role-based authorization ---
const authenticate   = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/roleAuthorization');
// --- REPLACE END ---

// Ensure models are registered before middleware/routes
require('../models/User');
require('../models/Message');

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
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

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
const stripeWebhookRouter = require('../routes/stripeWebhook');
const paypalWebhookRouter = require('../routes/paypalWebhook');

app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
app.use('/api/payment/paypal-webhook', paypalWebhookRouter);

// ── Serve uploads ───────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Auth endpoints with validation ──────────────────────────────────────────────
// --- REPLACE START: apply request validators for login & register ---
app.post(
  '/api/auth/login',
  validateBody(loginSchema),
  authController.login
);
app.post(
  '/api/auth/register',
  validateBody(registerSchema),
  authController.register
);
// --- REPLACE END ---

// Mount public auth routes (other than login/register)
// --- REPLACE START: ensure cookieParser applied BEFORE authRoutes ---
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
// --- REPLACE END ---

// ── Protected user routes (admin + user) ───────────────────────────────────────
// --- REPLACE START: protect user routes with auth + roles + validation ---
const userRoutes = require('../routes/user');
app.use(
  '/api/users',
  authenticate,
  authorizeRoles('admin', 'user'),
  validateBody(createUserSchema),
  userRoutes
);
// --- REPLACE END ---

// ── Protected message routes (user only) ───────────────────────────────────────
const messageRoutes = require('../routes/message');
app.use(
  '/api/messages',
  authenticate,
  authorizeRoles('user'),
  messageRoutes
);

// ── Protected payment routes (user only) ───────────────────────────────────────
const paymentRoutes = require('../routes/payment');
app.use(
  '/api/payment',
  authenticate,
  authorizeRoles('user'),
  paymentRoutes
);

// ── Admin-only routes ──────────────────────────────────────────────────────────
const adminRoutes = require('../routes/admin');
app.use(
  '/api/admin',
  authenticate,
  authorizeRoles('admin'),
  adminRoutes
);

// ── Protected discover routes (user only) ──────────────────────────────────────
const discoverRoutes = require('../routes/discover');
app.use(
  '/api/discover',
  authenticate,
  authorizeRoles('user'),
  discoverRoutes
);

// ── Temporary mock users endpoint ────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  // …unchanged mock data…
  res.json([/* … */]);
});

// ── Multer error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  next(err);
});

// ── 404 handler ─────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Global error handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server Error' });
});

// ── SOCKET.IO INTEGRATION ──────────────────────────────────────────────────────
const { initializeSocket } = require('./socket');
const httpServer           = initializeSocket(app);
const PORT                 = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server + Socket.io running on port ${PORT}`);
});

module.exports = app;
