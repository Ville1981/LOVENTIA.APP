// PATH: server/src/server.js

// --- REPLACE START: re-order imports (env before mongoose) and ensure explicit router loading ---
import app from './app.js';
import { env } from './config/env.js';
import { connectMongo } from './loaders/mongoose.js';
import likesRoutes from './routes/likes.js';

// ❗ Explicitly load the real root router so Express never falls back
// to the placeholder at server/_openapi_phase_pack/src/routes/index.js.
import rootRouter from './routes/index.js';
// --- REPLACE END ---

// ---------------------------------------------------------------------
// Attach root router BEFORE any fallback mounts.
// This guarantees the API route tree is registered correctly.
// ---------------------------------------------------------------------
app.use('/', rootRouter);

// ---------------------------------------------------------------------
// Safe fallback mount of likes routes.
// Express will harmlessly de-duplicate if also mounted in app.js.
// ---------------------------------------------------------------------
app.use('/api/likes', likesRoutes);

// ---------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------
const PORT = Number(env.PORT || process.env.PORT || 5000);
const HOST = env.HOST || process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------------
// Connect to MongoDB (startup should continue even if connection fails)
// ---------------------------------------------------------------------
try {
  await connectMongo();
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[server] Mongo connection attempt failed at startup:', e?.message || e);
}

// ---------------------------------------------------------------------
// Start HTTP server
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------
async function shutdown(signal = 'SIGTERM') {
  try {
    // eslint-disable-next-line no-console
    console.log(`[server] ${signal} received: closing HTTP server…`);
    await new Promise((resolve) => httpServer?.close(resolve));

    // If connectMongo exposes a close handler, it can be called here.
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

// ---------------------------------------------------------------------
// Uncaught/unhandled error diagnostics (non-fatal)
// ---------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  const msg = reason && reason.message ? reason.message : String(reason);
  // eslint-disable-next-line no-console
  console.error('[server] unhandledRejection:', msg);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[server] uncaughtException:', err?.message || err);
});


