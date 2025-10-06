// --- REPLACE START: ESM shim that re-exports root moderation middlewares ---
/**
 * ESM shim for moderation middlewares.
 * Allows src/* ESM code to `import { profanityFilter, moderationRateLimiter } from "../middleware/moderation.js"`.
 * Proxies to the root implementation at ../../middleware/moderation.js (CJS/ESM dual-mode).
 */

let _mod = null;

async function loadRootModeration() {
  if (_mod) return _mod;

  // Prefer ESM dynamic import
  try {
    const esm = await import("../../middleware/moderation.js");
    _mod = esm?.default ? esm.default : esm;
    return _mod;
  } catch {
    // Fallback to CJS require (no-op in pure ESM envs)
    try {
      // eslint-disable-next-line import/no-commonjs, global-require
      const cjs = require("../../middleware/moderation.js");
      _mod = cjs?.default ? cjs.default : cjs;
      return _mod;
    } catch {
      _mod = {};
      return _mod;
    }
  }
}

export async function profanityFilter(req, res, next) {
  const m = await loadRootModeration();
  const fn = m.profanityFilter || (typeof m === "function" ? m : null);
  if (typeof fn === "function") return fn(req, res, next);
  // If not available, pass-through to avoid breaking requests
  return typeof next === "function" ? next() : undefined;
}

export async function moderationRateLimiter(req, res, next) {
  const m = await loadRootModeration();
  const rl = m.moderationRateLimiter;
  if (typeof rl === "function") {
    // express-rate-limit returns a middleware factory or middleware function depending on version
    // If rl.length >= 1, treat as middleware; otherwise call to get middleware.
    const handler = rl.length >= 1 ? rl : rl();
    return handler(req, res, next);
  }
  return typeof next === "function" ? next() : undefined;
}

// Named + default export (so `import * as mod` and `import mod` both work)
const defaultExport = { profanityFilter, moderationRateLimiter };
export default defaultExport;

// Optional CJS interop (safe no-op in ESM-only setups)
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== "undefined" && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = defaultExport;
  }
} catch {
  // no-op
}
// --- REPLACE END ---
