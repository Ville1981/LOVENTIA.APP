// server/index.js

// --- REPLACE START: load environment variables as early as possible ---
import 'dotenv/config';
// --- REPLACE END ---

// --- REPLACE START: core module imports using ES modules ---
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

// --- REPLACE START: import webhook routers using ES modules ---
import stripeWebhookRouter from './routes/stripeWebhook.js';
import paypalWebhookRouter from './routes/paypalWebhook.js';
// --- REPLACE END ---

// --- REPLACE START: import application routes using ES modules ---
import authRoutes from './routes/auth.js';
import userRoutes from './routes/userRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import paymentRoutes from './routes/payment.js';
import discoverRoutes from './routes/discover.js';
import messageRoutes from './routes/messageRoutes.js';
import authenticate from './middleware/auth.js';
// --- REPLACE END ---

const app = express();

// Swagger-UI Integration
// --- REPLACE START: Swagger integration (fixed OpenAPI path) ---
const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// --- REPLACE END ---

// Stripe & PayPal webhooks (raw body for signature checks)
app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
app.use('/api/payment/paypal-webhook', paypalWebhookRouter);

// Common middleware
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

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- REPLACE START: serve static files from client-dist for production ---
app.use(express.static(path.join(__dirname, 'client-dist')));
// --- REPLACE END ---

// Mount routes
// --- REPLACE START: mount auth routes before protected routes ---
app.use('/api/auth', authRoutes);
// --- REPLACE END ---

// Protected routes
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/images', authenticate, imageRoutes);
app.use('/api/payment', authenticate, paymentRoutes);
app.use('/api/discover', authenticate, discoverRoutes);

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
  if (err.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  next(err);
});

// --- REPLACE START: fallback to index.html for SPA routes ---
app.get('/*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client-dist', 'index.html'));
});
// --- REPLACE END ---

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

// Global error handler
app.use((err, _req, res) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server Error' });
});

// Start server & connect to MongoDB
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

    // --- REPLACE START: handle EADDRINUSE on listen ---
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`⚠️ Port ${PORT} in use, retrying on port ${PORT + 1}...`);
        server.listen(PORT + 1, () =>
          console.log(`✅ Server running on http://localhost:${PORT + 1}`)
        );
      } else {
        console.error('❌ Server error:', err);
        process.exit(1);
      }
    });
    // --- REPLACE END ---
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- REPLACE START: export app for use in tests/other modules ---
export default app;
// --- REPLACE END ---
