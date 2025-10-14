// --- REPLACE START: Mongo bootstrap (ESM-safe, retry, model registration) ---
import 'dotenv/config';
import mongoose from 'mongoose';

/**
 * Idempotent Mongo bootstrap:
 * - Connects to MongoDB with retry/backoff (no-op if already connected)
 * - Registers commonly used models by importing their modules once
 * - Leaves the rest of your large app.js intact
 *
 * How to use (in app.js, once, before routes that touch models):
 *   await (await import('./bootstrap/mongo.js')).default();
 */

const STATE = {
  bootstrapped: false,
  connecting: null,
};

const DEFAULTS = {
  uri:
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/loventia',
  dbName: process.env.MONGODB_DB || process.env.MONGO_DB || undefined,
  maxRetries: Number(process.env.MONGO_MAX_RETRIES || 8),
  // backoff: 0.5s, 1s, 2s, 4s, ... capped
  baseDelayMs: Number(process.env.MONGO_BASE_DELAY_MS || 500),
  maxDelayMs: Number(process.env.MONGO_MAX_DELAY_MS || 8000),
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nextDelay(attempt) {
  const d = Math.min(DEFAULTS.baseDelayMs * 2 ** attempt, DEFAULTS.maxDelayMs);
  // small jitter to avoid thundering herds on restarts
  return Math.floor(d * (0.85 + Math.random() * 0.3));
}

async function connectWithRetry() {
  if (mongoose.connection.readyState === 1) return mongoose.connection; // already connected
  if (STATE.connecting) return STATE.connecting; // in-flight connect

  const opts = {
    autoIndex: true,
    // You can set dbName here if you use a single URI without it:
    ...(DEFAULTS.dbName ? { dbName: DEFAULTS.dbName } : {}),
  };

  STATE.connecting = (async () => {
    let errLast = null;
    for (let attempt = 0; attempt <= DEFAULTS.maxRetries; attempt += 1) {
      try {
        // Node 18+ ESM safe connect
        await mongoose.connect(DEFAULTS.uri, opts);
        // Guard: connection open?
        if (mongoose.connection.readyState === 1) {
          // Optional: tune query parsing mode to silence deprecations
          try {
            mongoose.set('strictQuery', true);
          } catch {}
          return mongoose.connection;
        }
        throw new Error('Connected but readyState !== 1');
      } catch (err) {
        errLast = err;
        const isLast = attempt === DEFAULTS.maxRetries;
        const delay = nextDelay(attempt);
        // eslint-disable-next-line no-console
        console.error(
          `[mongo] connect attempt ${attempt + 1}/${
            DEFAULTS.maxRetries + 1
          } failed: ${err?.message || err}. ${isLast ? 'Giving up.' : `Retrying in ${delay}ms…`}`
        );
        if (isLast) break;
        await sleep(delay);
      }
    }
    throw errLast || new Error('Mongo connection failed (unknown error)');
  })();

  try {
    const conn = await STATE.connecting;
    return conn;
  } finally {
    STATE.connecting = null;
  }
}

/**
 * Ensure models are registered before any route calls `mongoose.model('Name')`.
 * We import your ESM wrappers that bridge to the underlying schemas.
 *
 * NOTE: All imports are best-effort — if a file is missing, we warn but do not crash,
 *       except for `User`, which is required by several routes (e.g. og.js).
 */
async function ensureModels() {
  // Import your ESM “bridge” models from server/src/models/*
  // These files should export a default Mongoose model and/or register with mongoose.
  const required = [
    '../models/User.js',     // must exist (used by OG/profile, admin exports, etc.)
  ];
  const optional = [
    '../models/Message.js',
    '../models/Match.js',
    '../models/Payment.js',
    '../models/Like.js',
  ];

  // Load required first
  for (const rel of required) {
    try {
      const m = await import(rel);
      if (!m?.default && !m?.User && !m?.UserModel) {
        // eslint-disable-next-line no-console
        console.warn(`[mongo] Required model ${rel} loaded but no obvious default export; continuing.`);
      }
    } catch (e) {
      // Required: rethrow with clear message
      throw new Error(`[mongo] Failed to load required model ${rel}: ${e?.message || e}`);
    }
  }

  // Load optional ones (best-effort)
  for (const rel of optional) {
    try {
      await import(rel);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[mongo] Optional model ${rel} not loaded: ${e?.message || e}`);
    }
  }
}

/**
 * Public bootstrap entry (default export).
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export default async function bootstrapMongo() {
  if (STATE.bootstrapped && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Attach connection logs once
  if (!STATE.bootstrapped) {
    mongoose.connection.on('connected', () => {
      // eslint-disable-next-line no-console
      console.log(`[mongo] connected: ${DEFAULTS.uri}`);
    });
    mongoose.connection.on('disconnected', () => {
      // eslint-disable-next-line no-console
      console.warn('[mongo] disconnected');
    });
    mongoose.connection.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[mongo] error:', err?.message || err);
    });
  }

  const conn = await connectWithRetry();
  await ensureModels();

  STATE.bootstrapped = true;
  return conn;
}
// --- REPLACE END ---
