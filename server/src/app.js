// server/src/app.js

// --- REPLACE START: core imports remain (ESM) ---
import expressLoader from './loaders/express.js';
import { connectMongo } from './loaders/mongoose.js';
import securityMiddleware from './middleware/security.js';
import routes from './routes/index.js';
import stripeWebhooks from './webhooks/stripe.js';
import { notFound, errorHandler } from './middleware/error.js';
import { env } from './config/env.js';
// --- REPLACE END ---

// Initialize Express app via loader (sets parsers, CORS, static, etc.)
const app = expressLoader();

/**
 * Mount order matters:
 * 1) Webhooks first (Stripe/PayPal, etc.) so they can use raw body parsers internally.
 * 2) Security middlewares bundle (helmet, rate limits, sanitizers, etc.).
 * 3) API routes under /api.
 * 4) Diagnostics endpoints (in dev) to list mounted routes.
 * 5) 404 and global error handler last.
 */

// Webhooks (place raw-body handlers inside the webhooks module)
app.use('/webhooks', stripeWebhooks);

// Security middlewares bundle
app.use(securityMiddleware);

// API routes
app.use('/api', routes);

// --- REPLACE START: diagnostics route listing (/__routes, /__routes_full) ---
/**
 * Lightweight diagnostics to list mounted routes.
 * Placed before the 404 handler. Safe in dev; guard by NODE_ENV if desired.
 */
function getMountPathFromLayer(layer) {
  try {
    const src = layer?.regexp?.source || '';
    if (!src) return '';
    let s = src;
    s = s.replace(/^\^/, '');
    s = s.replace(/\\\/\?\(\?=\\\/\|\$\)\$$/i, ''); // strip trailing '\/?(?=\/|$)'
    s = s.replace(/\\\//g, '/');
    s = s.replace(/\$$/, '');
    if (!s.startsWith('/')) s = '/' + s;
    return s;
  } catch {
    return '';
  }
}

app.get('/__routes', (_req, res) => {
  try {
    const routesList = [];
    const stack = Array.isArray(app._router?.stack) ? app._router.stack : [];
    for (const layer of stack) {
      if (layer?.route) {
        const methods = Object.keys(layer.route.methods || {})
          .map((m) => m.toUpperCase())
          .join(',');
        const p = typeof layer.route.path === 'string' ? layer.route.path : '';
        routesList.push(`${methods} ${p}`);
        continue;
      }
      if (layer?.name === 'router' && Array.isArray(layer.handle?.stack)) {
        const mount = getMountPathFromLayer(layer);
        for (const h of layer.handle.stack) {
          if (h?.route) {
            const methods = Object.keys(h.route.methods || {})
              .map((m) => m.toUpperCase())
              .join(',');
            const sub = typeof h.route.path === 'string' ? h.route.path : '';
            routesList.push(`${methods} ${(mount + sub).replace(/\/{2,}/g, '/')}`);
          }
        }
      }
    }
    res.json(routesList);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.get('/__routes_full', (_req, res) => {
  function walk(stack, base = '') {
    const out = [];
    if (!Array.isArray(stack)) return out;
    for (const layer of stack) {
      if (layer?.route) {
        const routePath = typeof layer.route.path === 'string' ? layer.route.path : '';
        const methods = Object.keys(layer.route.methods || {}).map((m) => m.toUpperCase());
        const full = (base + (routePath || '')).replace(/\/{2,}/g, '/') || '/';
        for (const m of methods) out.push(`${m} ${full}`);
        continue;
      }
      if (layer?.name === 'router' && Array.isArray(layer.handle?.stack)) {
        const mount = getMountPathFromLayer(layer) || '';
        const nextBase = (base + mount).replace(/\/{2,}/g, '/');
        out.push(...walk(layer.handle.stack, nextBase));
      }
    }
    return out;
  }

  try {
    const root = Array.isArray(app._router?.stack) ? app._router.stack : [];
    res.json(walk(root));
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});
// --- REPLACE END ---

// 404 + error handling (keep LAST)
app.use(notFound);
app.use(errorHandler);

// Start when called directly (node ./src/app.js)
if (process.argv[1] && process.argv[1].endsWith('app.js')) {
  (async () => {
    try {
      await connectMongo();
    } catch (e) {
      console.warn('[server] Mongo connection attempt failed at startup:', e?.message || e);
    }
    const PORT = Number(env.PORT || process.env.PORT || 5000);
    const HOST = env.HOST || process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => console.log(`[server] listening on ${HOST}:${PORT}`));
  })();
}

export default app;
