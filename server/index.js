// --- REPLACE START: load environment variables early ---
import 'dotenv/config';
// --- REPLACE END ---
import meRouter from "./routes/me.js";

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
// Keep existing folder structure but FIX users route to the modern router (avoids legacy duplicates).
import * as AuthPublicModule from './src/routes/authRoutes.js';
const authRoutes = AuthPublicModule.default || AuthPublicModule;

import * as AuthPrivateModule from './src/routes/authPrivateRoutes.js';
const authPrivateRoutes = AuthPrivateModule.default || AuthPrivateModule;

// ✅ users router (modern ESM/CJS compatible)
import * as UsersRouterModule from './routes/userRoutes.js'; // --- CHANGED from ./routes/user.js ---
const userRoutes = UsersRouterModule.default || UsersRouterModule;

// ✅ imageRoutes are imported and WILL be mounted under /api/images for back-compat
import * as ImageModule from './routes/imageRoutes.js';
const imageRoutes = ImageModule.default || ImageModule;

import * as MessageModule from './routes/messageRoutes.js';
const messageRoutes = MessageModule.default || MessageModule;

import * as DiscoverModule from './routes/discover.js';
const discoverRoutes = DiscoverModule.default || DiscoverModule;

// Billing routes
// NOTE: We mount this router at *both* /api/billing and /api/payment for backward compatibility.
// The router file itself must NOT include an extra `/billing` prefix in its internal paths.
import * as BillingRouterModule from './routes/payment.js';
const billingRoutes = BillingRouterModule.default || BillingRouterModule;

// ✅ NEW: premium feature routes (handle CommonJS OR ESM)
import * as RewindModule from './routes/rewind.js';
const rewindRoutes = RewindModule.default || RewindModule;

import * as IntrosModule from './routes/intros.js';
const introsRoutes = IntrosModule.default || IntrosModule;

import * as DealbreakersModule from './routes/dealbreakers.js';
const dealbreakersRoutes = DealbreakersModule.default || DealbreakersModule;

// (Optional) If you have QA routes, import here (kept tolerant if file missing).
// import * as QaModule from './routes/qa.js';
// const qaRoutes = QaModule?.default || QaModule;
// --- REPLACE END ---

// --- REPLACE START: Middleware ---
import * as AuthenticateModule from './middleware/authenticate.js';
const authenticate = AuthenticateModule.default || AuthenticateModule;
// --- REPLACE END ---

const app = express();

/* ──────────────────────────────────────────────────────────────────────────────
   MongoDB connection (robust) + DB readiness guard
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: Robust Mongo config (disable buffering) + dbReady middleware ---
try {
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false); // prevent silent buffering timeouts
} catch {}

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.warn('⚠️ MONGO_URI is not set. The server will start without DB connection.');
} else {
  mongoose
    .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      const { host, port, name } = mongoose.connection;
      console.log(`✅ MongoDB connected → ${host}:${port}/${name}`);
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err?.message || err);
    });
}

mongoose.connection.on('connected', () => console.log('✅ Mongo connected'));
mongoose.connection.on('disconnected', () => console.warn('⚠️ Mongo disconnected'));
mongoose.connection.on('error', (e) => console.error('❌ Mongo error:', e?.message || e));

/** Guard DB-backed endpoints so we return 503 instead of Mongoose buffering timeouts. */
function dbReady(_req, res, next) {
  if (mongoose.connection.readyState === 1) return next(); // 1 = connected
  return res.status(503).json({ error: 'Database not connected. Please try again shortly.' });
}
// --- REPLACE END ---

// --- REPLACE START: Sentry request/tracing handlers ---
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
// --- REPLACE END ---

// Lightweight router already present
app.use("/api", meRouter);

// --- REPLACE START: Register feature routes under /api ---
// These were previously mounted with require(); now mounted via ESM-friendly imports.
app.use('/api', rewindRoutes);        // exposes POST /api/rewind
app.use('/api', introsRoutes);        // GET /api/intros, POST /api/intros/start
app.use('/api', dealbreakersRoutes);  // GET/PATCH /api/dealbreakers, POST /api/discover/search
// If you have QA: uncomment next line
// app.use('/api', qaRoutes);
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Swagger
────────────────────────────────────────────────────────────────────────────── */
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
 * Webhooks must read the raw body for signature verification.
 * Keep BEFORE json/urlencoded parsers.
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
  'http://localhost:5173',
  'http://127.0.0.1:5173',
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

// --- REPLACE START: static /uploads serving with process.cwd() (and ensure dir exists) ---
/**
 * Serve user-uploaded assets. Using process.cwd() makes this robust when the server
 * is started from project root even if transpiled dirs differ from __dirname.
 * Keep this AFTER CORS so GET /uploads/** inherits CORS headers.
 *
 * Also ensure common sub-directories exist to avoid Multer ENOENT issues.
 */
const uploadsAbs = path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(uploadsAbs)) fs.mkdirSync(uploadsAbs, { recursive: true });
  // --- REPLACE START: ensure subdirectories exist (avatars, extra) ---
  for (const sub of ['avatars', 'extra']) {
    const dir = path.join(uploadsAbs, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  // --- REPLACE END ---
} catch (e) {
  console.warn('⚠️ Could not ensure /uploads dir:', e?.message || e);
}
app.use('/uploads', express.static(uploadsAbs, {
  // Optional caching; tweak if needed
  maxAge: process.env.STATIC_MAX_AGE || '1d',
  immutable: false,
  setHeaders(res) {
    // Make sure CORS is friendly for assets when behind CDN/dev
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));
// --- REPLACE END ---

// --- REPLACE START: serve client-dist if exists ---
const clientDistDir = path.join(__dirname, 'client-dist');
const hasClientDist = fs.existsSync(clientDistDir);

if (hasClientDist) {
  console.log('🧩 client-dist detected -> enabling static client');
  app.use(express.static(clientDistDir));
} else {
  console.warn('⚠️  /client-dist not found -> skipping static client serving.');
}
// --- REPLACE END ---

// --- REPLACE START: Mount routes (guard DB-backed stacks with dbReady) ---
app.use('/api/auth', dbReady, authRoutes);
app.use('/api/auth', dbReady, authPrivateRoutes);
app.use('/api/messages', dbReady, authenticate, messageRoutes);

// ✅ Users route stack (modern router)
app.use('/api/users', dbReady, authenticate, userRoutes);

// ✅ Back-compat: mount legacy image routes under /api/images
//    FE uploaders that still use /api/images/* will continue to work.
//    (If you later migrate FE to /api/users/:userId/*, you can keep this as an alias.)
app.use('/api/images', dbReady, authenticate, imageRoutes);

app.use('/api/discover', dbReady, authenticate, discoverRoutes);

// Billing mount (both prefixes supported)
app.use('/api/billing', dbReady, authenticate, billingRoutes);
app.use('/api/payment', dbReady, authenticate, billingRoutes);

// Keep previously registered feature routers (already mounted above):
// - /api/rewind, /api/intros, /api/dealbreakers
// --- REPLACE END ---

// --- REPLACE START: Cookie helpers ---
const isProd = process.env.NODE_ENV === 'production';
export const cookieOptions = {
  httpOnly: true,
  sameSite: isProd ? 'None' : 'Lax',
  secure: isProd,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
};
// --- REPLACE END ---

// Mock users
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

// Multer error handler
app.use((err, _req, res, next) => {
  if (err?.name === 'MulterError') {
    return res.status(413).json({ error: err.message });
  }
  return next(err);
});

// --- REPLACE START: unknown /api/* 404 ---
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
// --- REPLACE END ---

// --- REPLACE START: SPA fallback ---
if (hasClientDist) {
  app.get('*', (req, res, next) => {
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
  app.get('/', (_req, res) =>
    res.status(200).json({ ok: true, message: 'Loventia API (client served separately).' })
  );
}
// --- REPLACE END ---

// 404 handler
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
            lines.push(`${methods.padEnd(6)} ${r.route.path}`);
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

// --- REPLACE START: HTTP server start (port 5000 default) ---
const PORT = process.env.PORT || 5000;

printRoutes(app);

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.error(`⚠️ Port ${PORT} in use, retrying on ${nextPort}...`);
    app.listen(nextPort, () => console.log(`✅ Server running on http://localhost:${nextPort}`));
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});
// --- REPLACE END ---

export default app;
