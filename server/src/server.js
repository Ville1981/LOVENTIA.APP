// PATH: server/src/server.js

// --- REPLACE START: minimal but robust server bootstrap with graceful shutdown ---
import app from './app.js';
import { connectMongo } from './loaders/mongoose.js';
import { env } from './config/env.js';

// Ensure required envs have sane defaults (non-fatal if missing)
const PORT = Number(env.PORT || process.env.PORT || 5000);
const HOST = env.HOST || process.env.HOST || '0.0.0.0';

// Connect to MongoDB (do not crash if unavailable; app may expose /healthz etc.)
try {
  await connectMongo();
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[server] Mongo connection attempt failed at startup:', e?.message || e);
}

// Start HTTP server
let httpServer;
try {
  httpServer = app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on ${HOST}:${PORT}`);
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[server] failed to start:', err?.message || err);
  process.exit(1);
}

// Graceful shutdown
async function shutdown(signal = 'SIGTERM') {
  try {
    // eslint-disable-next-line no-console
    console.log(`[server] ${signal} received: closing HTTP server…`);
    await new Promise((resolve) => httpServer?.close(resolve));
    // If connectMongo provided a close helper you can import/use it here.
    // eslint-disable-next-line no-console
    console.log('[server] shutdown complete');
    process.exit(0);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[server] error during shutdown:', e?.message || e);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Helpful diagnostics for unhandled errors (does not crash the process)
process.on('unhandledRejection', (reason) => {
  const msg = reason && reason.message ? reason.message : String(reason);
  // eslint-disable-next-line no-console
  console.error('[server] unhandledRejection:', msg);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[server] uncaughtException:', err?.message || err);
});
// --- REPLACE END ---
