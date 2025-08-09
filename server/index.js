// --- REPLACE START: load environment variables early ---
import 'dotenv/config';
// --- REPLACE END ---

// --- REPLACE START: Sentry initialization ---
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 1.0,
});
// --- REPLACE END ---

// --- REPLACE START: Core imports ---
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
// --- REPLACE END ---

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- REPLACE START: Ensure models are loaded ---
import './models/User.js';
import './models/Message.js';
// --- REPLACE END ---

// --- REPLACE START: Webhook routes ---
import stripeWebhookRouter from './routes/stripeWebhook.js';
import paypalWebhookRouter from './routes/paypalWebhook.js';
// --- REPLACE END ---

// --- REPLACE START: App routes ---
// NOTE: We use the routes that actually exist in your repo listing.
import * as AuthModule from './src/routes/authRoutes.js';
const authRoutes = AuthModule.default || AuthModule;

import * as UserModule from './routes/userRoutes.js';
const userRoutes = UserModule.default || UserModule;

import * as ImageModule from './routes/imageRoutes.js';
const imageRoutes = ImageModule.default || ImageModule;

import * as MessageModule from './routes/messageRoutes.js';
const messageRoutes = MessageModule.default || MessageModule;

// Discover / Payment can be wired when files exist
// import * as DiscoverModule from './routes/discover.js';
// const discoverRoutes = DiscoverModule.default || DiscoverModule;
// import * as PaymentModule from './routes/payment.js';
// const paymentRoutes = PaymentModule.default || PaymentModule;
// --- REPLACE END ---

// --- REPLACE START: Middleware ---
import * as AuthenticateModule from './middleware/authenticate.js';
const authenticate = AuthenticateModule.default || AuthenticateModule;
// --- REPLACE END ---

const app = express();

// --- REPLACE START: Sentry request/tracing handlers ---
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
// --- REPLACE END ---

// --- REPLACE START: Swagger setup ---
const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// --- REPLACE END ---

/**
 * IMPORTANT: Webhooks must read the raw body for signature verification.
 * These routers are expected to configure their own raw body parsers.
 */
app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
app.use('/api/payment/paypal-webhook', paypalWebhookRouter);

// --- REPLACE START: Common middleware ---
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5174',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// --- REPLACE END ---

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files in production
app.use(express.static(path.join(__dirname, 'client-dist')));

// --- REPLACE START: mount auth routes before protected routes ---
app.use('/api/auth', authRoutes);
// --- REPLACE END ---

// Protected routes
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/images', authenticate, imageRoutes);
// if (typeof paymentRoutes !== 'undefined') app.use('/api/payment', authenticate, paymentRoutes);
// if (typeof discoverRoutes !== 'undefined') app.use('/api/discover', authenticate, discoverRoutes);

// Temporary mock-users endpoint
app.get('/api/mock-users', (_req, res) => {
  const user = {
    _id: '1',
    name: 'Bunny',
    age: 45,
    city: 'Rayong',
    region: 'Chonburi',
    country: 'Thailand',
    compatibility: 88,
    photos: ['/uploads/bunny1.jpg', '/uploads/bunny2.jpg', '/uploads/bunny3.jpg'],
    youPhoto: '/uploads/your-avatar.jpg',
    profilePhoto: '/uploads/bunny-avatar.jpg',
    agreeCount: 6,
    disagreeCount: 3,
    findOutCount: 4,
    summary: 'Positive mindset, self-development …',
    details: {},
  };
  return res.json([user]);
});

// Multer-specific error handler
app.use((err, _req, res, next) => {
  if (err && err.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  return next(err);
});

// Healthcheck
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// SPA fallback
app.get('/*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client-dist', 'index.html'));
});

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

// --- REPLACE START: Sentry error handler + proper Express signature ---
app.use(Sentry.Handlers.errorHandler());
app.use((err, _req, res, _next) => {
  console.error(err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Server Error' });
});
// --- REPLACE END ---

// --- REPLACE START: Recursive route logger (prints nested Router paths) ---
function printRoutes(appInstance) {
  const seen = new Set();
  function walk(stack, prefix = '') {
    stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .join(', ');
        const line = `${methods.padEnd(6)} ${prefix}${layer.route.path}`;
        if (!seen.has(line)) {
          seen.add(line);
          console.log('  ' + line);
        }
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        const nestedPrefix = layer.regexp && layer.regexp.fast_slash
          ? prefix
          : (layer.regexp?.source || '')
              .replace('^\\', '')
              .replace('\\/?(?=\\/|$)', '')
              .replace('^', '')
              .replace('$', '')
              .replace('\\/', '/');
        const cleanPrefix = nestedPrefix === '(?:\\/)?' ? '/' : nestedPrefix;
        walk(layer.handle.stack, prefix + cleanPrefix);
      }
    });
  }
  console.log('🛣️ Registered routes:');
  walk(appInstance._router.stack, '');
}
// --- REPLACE END ---

// --- REPLACE START: MongoDB connection and server start ---
mongoose.set('strictQuery', true);
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    printRoutes(app);

    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        const nextPort = Number(PORT) + 1;
        console.error(`⚠️ Port ${PORT} in use, retrying on port ${nextPort}...`);
        app.listen(nextPort, () =>
          console.log(`✅ Server running on http://localhost:${nextPort}`)
        );
      } else {
        console.error('❌ Server error:', err);
        process.exit(1);
      }
    });
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));
// --- REPLACE END ---

// --- REPLACE START: export app for use in tests/other modules ---
export default app;
// --- REPLACE END ---
