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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
// --- REPLACE END ---

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
import * as AuthPublicModule from './src/routes/authRoutes.js';
const authRoutes = AuthPublicModule.default || AuthPublicModule;

import * as AuthPrivateModule from './src/routes/authPrivateRoutes.js';
const authPrivateRoutes = AuthPrivateModule.default || AuthPrivateModule;

import * as UserModule from './routes/userRoutes.js';
const userRoutes = UserModule.default || UserModule;

import * as ImageModule from './routes/imageRoutes.js';
const imageRoutes = ImageModule.default || ImageModule;

import * as MessageModule from './routes/messageRoutes.js';
const messageRoutes = MessageModule.default || MessageModule;

// --- REPLACE START: import discover routes (ESM/CJS interop) ---
import * as DiscoverModule from './routes/discover.js';
const discoverRoutes = DiscoverModule.default || DiscoverModule;
// --- REPLACE END ---
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
const swaggerPath = path.join(__dirname, 'openapi.yaml');
if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = YAML.load(swaggerPath);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
  console.warn('ℹ️ openapi.yaml not found -> Swagger UI disabled.');
}
// --- REPLACE END ---

/**
 * IMPORTANT: Webhooks must read the raw body for signature verification.
 * NOTE: The routers themselves should use express.raw() where necessary.
 * Keep webhooks BEFORE json/urlencoded body parsers.
 */
app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
app.use('/api/payment/paypal-webhook', paypalWebhookRouter);

// --- REPLACE START: Common middleware (robust CORS + credentials) ---
app.use(cookieParser());

const envWhitelist = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_2,
  process.env.PROD_URL,
].filter(Boolean);

const staticWhitelist = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost',
  'http://127.0.0.1',
  'https://loventia.app',
  'https://www.loventia.app',
];

const allowedOrigins = Array.from(new Set([...envWhitelist, ...staticWhitelist]));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: [],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
// --- REPLACE END ---

// --- REPLACE START: Healthcheck under /api ---
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'loventia-api',
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});
app.head('/api/health', (_req, res) => res.sendStatus(200));
// --- REPLACE END ---

// Serve uploads directory (always)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- REPLACE START: conditionally serve client build (avoid ENOENT spam) ---
const clientDistDir = path.join(__dirname, 'client-dist');
const hasClientDist = fs.existsSync(clientDistDir);

if (hasClientDist) {
  console.log('🧩 client-dist detected -> enabling static client from /client-dist');
  app.use(express.static(clientDistDir));
} else {
  console.warn('⚠️  /client-dist not found -> skipping static client serving (expected when client runs in its own container).');
}
// --- REPLACE END ---

// --- REPLACE START: Mount routes ---
app.use('/api/auth', authRoutes);
app.use('/api/auth', authPrivateRoutes);
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/images', authenticate, imageRoutes);
app.use('/api/discover', authenticate, discoverRoutes);
// --- REPLACE END ---

// Mock users (dev only)
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
  if (err?.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  return next(err);
});

// --- REPLACE START: ensure unknown /api/* returns JSON 404 ---
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
// --- REPLACE END ---

// --- REPLACE START: SPA fallback only if client-dist exists ---
if (hasClientDist) {
  app.get('*', (req, res, next) => {
    // Do not intercept API or webhook routes
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/stripe-webhook') ||
      req.path.startsWith('/paypal')
    ) {
      return next();
    }
    return res.sendFile(path.join(clientDistDir, 'index.html'));
  });
} else {
  // When client is served by a separate container, avoid a catch-all here.
  app.get('/', (_req, res) => res.status(200).json({ ok: true, message: 'Loventia API (client served by separate container).' }));
}
// --- REPLACE END ---

// 404 handler (non-API leftovers)
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

// --- REPLACE START: Sentry error handler ---
app.use(Sentry.Handlers.errorHandler());
app.use((err, _req, res, _next) => {
  console.error(err?.stack || err);
  res.status(500).json({ error: 'Server Error' });
});
// --- REPLACE END ---

// --- REPLACE START: Route logger ---
function printRoutes(appInstance) {
  try {
    const stack = appInstance?._router?.stack || [];
    const lines = [];
    for (const layer of stack) {
      if (layer?.route?.path) {
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .join(', ');
        lines.push(`${methods.padEnd(6)} ${layer.route.path}`);
      } else if (layer?.name === 'router' && layer?.handle?.stack) {
        for (const r of layer.handle.stack) {
          if (r?.route?.path) {
            const methods = Object.keys(r.route.methods)
              .map((m) => m.toUpperCase())
              .join(', ');
            const p = r.route.path;
            lines.push(`${methods.padEnd(6)} ${p}`);
          }
        }
      }
    }
    console.log('🛣️ Registered routes:');
    lines.forEach((l) => console.log('  ' + l));
  } catch (e) {
    console.log('🛣️ Route listing skipped:', e?.message || e);
  }
}
// --- REPLACE END ---

// --- REPLACE START: DB connection ---
mongoose.set('strictQuery', true);
const PORT = process.env.PORT || 5000;

console.log('[DB] MONGO_URI =', process.env.MONGO_URI ? '(set)' : '(missing)');
console.log('[ENV] NODE_ENV =', process.env.NODE_ENV);

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.warn('⚠️ MONGO_URI is not set. The server will start without DB connection.');
}

const startServer = () => {
  printRoutes(app);
  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
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
};

if (mongoUri) {
  mongoose
    .connect(mongoUri)
    .then(() => {
      console.log('✅ MongoDB connected');
      startServer();
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err?.message || err);
      startServer();
    });
} else {
  startServer();
}
// --- REPLACE END ---

// --- REPLACE START: export app ---
export default app;
// --- REPLACE END ---
