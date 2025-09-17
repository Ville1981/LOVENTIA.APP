// --- REPLACE START: CommonJS bridge with require→ESM fallback (no vm-modules needed) ---
/**
 * CJS bridge for Jest/Supertest.
 * Tries to `require` the Express app first (fast & sync). If the target module is
 * ESM-only and throws ERR_REQUIRE_ESM, it falls back to dynamic `import()` for that case.
 *
 * Export shape: Promise<ExpressApp>
 *
 * Typical usage in tests:
 *   const appPromise = require('../app.cjs');
 *   let app;
 *   beforeAll(async () => { app = await appPromise; });
 *   it('works', async () => { await request(app).get('/healthcheck') ... });
 */

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CANDIDATES = [
  path.resolve(__dirname, 'src/app.js'),
  path.resolve(__dirname, 'app.js'),
  path.resolve(__dirname, 'index.js'),
];

function pickExpressExport(mod, fromPath) {
  const candidate =
    (mod && (mod.default || mod.app)) ||
    (typeof mod === 'function' ? mod : null);

  if (!candidate) {
    throw new Error(
      `Module loaded but no Express app export found in ${fromPath} (expected default export or { app }).`
    );
  }
  return candidate;
}

async function loadApp() {
  let lastErr = null;

  for (const p of CANDIDATES) {
    if (!fs.existsSync(p)) continue;

    // 1) Try CommonJS require first (preferred in Jest)
    try {
      const mod = require(p); // may throw ERR_REQUIRE_ESM if ESM-only
      return pickExpressExport(mod, p);
    } catch (err) {
      lastErr = err;
      const isEsmOnly =
        err && (err.code === 'ERR_REQUIRE_ESM' || /ERR_REQUIRE_ESM/.test(String(err.message)));

      // 2) If the module is ESM-only, fall back to dynamic import for THIS candidate
      if (isEsmOnly) {
        try {
          const url = pathToFileURL(p).href;
          const esm = await import(url);
          return pickExpressExport(esm, p);
        } catch (e) {
          lastErr = e;
          // continue to next candidate
        }
      }
      // For non-ESM errors, try next candidate.
    }
  }

  const tried = CANDIDATES.join(', ');
  const reason = lastErr ? ` Last error: ${lastErr.message}` : '';
  throw new Error(`Failed to load Express app. Tried: ${tried}.${reason}`);
}

module.exports = loadApp();
// --- REPLACE END ---
