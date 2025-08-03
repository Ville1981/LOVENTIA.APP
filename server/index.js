// index.js

// --- REPLACE START: load environment variables as early as possible ---
import 'dotenv/config';
// --- REPLACE END ---

// --- REPLACE START: import core modules using ESM ---
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
// --- REPLACE END ---

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure models are registered before middleware/routes
import './models/User.js';
import './models/Message.js';

// --- REPLACE START: import webhook routers using ESM ---
import stripeWebhookRouter from './routes/stripeWebhook.js';
import paypalWebhookRouter from './routes/paypalWebhook.js';
// --- REPLACE END ---

// --- REPLACE START: import application routes using ESM ---
import authRoutes from './routes/auth.js';
import userRoutes from './routes/userRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import paymentRoutes from './routes/payment.js';
import discoverRoutes from './routes/discover.js';
import authenticate from './middleware/authenticate.js';
import messageRoutes from './routes/messageRoutes.js';
// --- REPLACE END ---

const app = express();

// ── Swagger-UI Integration ─────────────────────────────────────────────────────
// --- REPLACE START: Swagger integration (fixed OpenAPI path) ---
const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// --- REPLACE END ---

// ── Stripe & PayPal webhooks ───────────────────────────────────────────────────
// These need to see the raw body, so they must come before express.json()
app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
app.use('/api/payment/paypal-webhook', paypalWebhookRouter);

// ── Common middleware ───────────────────────────────────────────────────────────
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

// ── Serve uploads folder as static files ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Mount application routes ────────────────────────────────────────────────────
// Mount Auth routes (no auth middleware)
// --- REPLACE START: ensure /api/auth is mounted before protected routes ---
app.use('/api/auth', authRoutes);
// --- REPLACE END ---

// Mount protected routes
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/images', authenticate, imageRoutes);
app.use('/api/payment', authenticate, paymentRoutes);
app.use('/api/discover', authenticate, discoverRoutes);

// ── Temporary mock users endpoint ───────────────────────────────────────────────
app.get('/api/mock-users', (req, res) => {
  const user = {
    _id: '1',
    name: 'Bunny',
    age: 45,
    city: 'Rayong',
    region: 'Chonburi',
    country: 'Thailand',
    compatibility: 88,
    photos: [
      '/uploads/bunny1.jpg',
      '/uploads/bunny2.jpg',
      '/uploads/bunny3.jpg',
    ],
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

// ── Multer-specific error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  next(err);
});

// ── 404 Not Found handler ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server Error' });
});

// ── Start server & connect to MongoDB ──────────────────────────────────────────
mongoose.set('strictQuery', true);
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    console.log('🛣️ Registered routes:');
    app._router.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .join(', ');
        console.log(`  ${methods.padEnd(6)} ${layer.route.path}`);
      }
    });
    app.listen(PORT, () =>
      console.log(`✅ Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- REPLACE START: export app for use in tests/other modules ---
export default app;
// --- REPLACE END ---
