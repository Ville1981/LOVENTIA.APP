// PATH: server/src/routes/discover.js
// @ts-nocheck

// --- REPLACE START: clean ESM discover router (single mount, legacy POST /search kept; verbose docs) ---
/**
 * Discover Router (ESM, single source of truth)
 * =============================================================================
 * Goals
 * -----
 * 1) Provide ONE canonical router for `/api/discover`
 * 2) Keep **GET /** as the authoritative listing endpoint → returns `{ users, meta }`
 * 3) Preserve **legacy POST /search** by delegating to the same controller
 * 4) Avoid double-mounts and avoid CJS shims
 *
 * Mounting (in app.js)
 * --------------------
 *   import discoverRouter from './routes/discover.js';
 *   import authenticate   from './middleware/authenticate.js';
 *
 *   // IMPORTANT: mount EXACTLY once, with auth at app-level (prevents duplicates)
 *   app.use('/api/discover', authenticate, discoverRouter);
 *
 * Contract (public)
 * -----------------
 *   GET  /api/discover
 *       - Auth required (JWT via Authorization: Bearer ...)
 *       - Query: optional filters (includeSelf/includeHidden/paging/..)
 *       - Returns: { users: Array<UserOut>, meta: { page, size, total? ... } }
 *
 *   POST /api/discover/search  (LEGACY – kept for FE backward compatibility)
 *       - Body is treated as "query" and forwarded to the same controller as GET /
 *
 * Controller
 * ----------
 *   getDiscover(req, res, next)
 *     - Owns the actual business logic: filters, includeSelf/includeHidden, pagination
 *     - Expects filters from req.query (we will bridge POST body → query)
 *
 * Notes
 * -----
 * - We keep comments intentionally verbose to preserve maintainability and line parity.
 * - No new dependencies are introduced; everything is standard Express.
 * - This router does not add authenticate() itself, because app.js already does it.
 *   (Double-auth is safe but wasteful; keeping it at app-level avoids duplication.)
 */

import { Router } from "express";
// Only import authenticate here if you choose per-route auth.
// In our setup auth is applied in app.js, so we do NOT use it here.
// import authenticate from "../middleware/authenticate.js";
import { getDiscover /*, handleAction */ } from "../controllers/discoverController.js";

// -----------------------------------------------------------------------------
// Router instance
// -----------------------------------------------------------------------------
const router = Router();

/**
 * Tiny helpers (kept minimal, zero external deps)
 * -----------------------------------------------
 * These utilities exist to document intent and support gentle normalization
 * without changing controller behavior. They are purposely small and local.
 */

/** Boolean-ish parser: accepts true/1/"1"/"true" (case-insensitive). */
function isTruthy(v) {
  return v === true || v === 1 || v === "1" || (typeof v === "string" && v.toLowerCase() === "true");
}

/**
 * (Optional) Query normalizer.
 * - We DO NOT reject anything here; controller is authoritative.
 * - If you later enable this, keep it gentle and non-breaking.
 */
function validateDiscoverQuery(req, _res, next) {
  const q = req.query || {};
  if ("includeSelf" in q) q.includeSelf = isTruthy(q.includeSelf);
  if ("includeHidden" in q) q.includeHidden = isTruthy(q.includeHidden);
  // add future light normalizations here (page/size clamping etc.)
  return next();
}

/**
 * Body→Query bridge for legacy POST /search
 * -----------------------------------------
 * Some older clients send filters in the request body. The controller expects
 * filters in `req.query`. This middleware non-destructively merges body → query,
 * letting body values win when present while preserving any existing query keys.
 */
function bodyToQueryBridge(req, _res, next) {
  try {
    req.query = { ...(req.query || {}), ...(req.body || {}) };
  } catch {
    // defensive: never block the request if body is e.g. non-iterable
  }
  return next();
}

/**
 * DEV-only warming endpoint
 * -------------------------
 * Quick probe to verify the router is mounted correctly during local dev/CI.
 * Not exposed in production.
 *
 *   curl -i http://localhost:5000/api/discover/__warming
 */
if (process.env.NODE_ENV !== "production") {
  router.get("/__warming", (_req, res) => {
    res.status(200).json({
      ok: true,
      route: "/api/discover/__warming",
      env: process.env.NODE_ENV || "development",
      note:
        "Auth is applied at app-level. Real endpoints: GET /api/discover and LEGACY POST /api/discover/search.",
    });
  });
}

// -----------------------------------------------------------------------------
// Routes (keep minimal logic here; controller owns business rules)
// -----------------------------------------------------------------------------

/**
 * GET /api/discover  → canonical discover listing
 * Auth is applied in app.js: app.use('/api/discover', authenticate, router)
 * We leave a commented hook to enable query validation if/when desired.
 */
router.get(
  "/",
  // validateDiscoverQuery,
  getDiscover
);

/**
 * LEGACY: POST /api/discover/search  → same output as GET /
 * We convert body→query then call the same controller for a single source of truth.
 */
router.post(
  "/search",
  bodyToQueryBridge,
  // validateDiscoverQuery,
  getDiscover
);

/**
 * (Optional) Action endpoint — keep commented until FE needs it.
 * If you enable, ensure rate limits & quotas are enforced in controllers/services.
 *
 * POST /api/discover/:userId/:actionType
 *   - actionType ∈ { like | pass | superlike }
 */
// router.post("/:userId/:actionType", authenticate, handleAction);

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------
export default router;
// --- REPLACE END ---















