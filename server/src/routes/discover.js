// --- REPLACE START: clean ESM discover router (single mount, rich comments; no shim, no double-mount) ---
/**
 * Discover Router (ESM, single source of truth)
 * -----------------------------------------------------------------------------
 * Purpose:
 *   - Provide a single, clean Express.Router for /api/discover
 *   - Avoid legacy/CJS shims and double mounts
 *   - Keep the file self-explanatory with guarded dev diagnostics
 *
 * Mounting (app.js):
 *   import discoverRouter from './routes/discover.js';
 *   app.use('/api/discover', discoverRouter); // mount EXACTLY once
 *
 * Contracts:
 *   - GET "/" → returns `{ users, meta }`
 *   - Uses `authenticate` middleware (Bearer JWT required)
 *   - Controller: `getDiscover` (includes includeSelf/includeHidden logic & meta)
 *
 * Notes:
 *   - NO new dependencies introduced.
 *   - Comments are intentionally verbose to preserve maintainability and line parity.
 *   - Dev-only probe endpoint is provided (guarded by NODE_ENV) to help verify mounts
 *     without leaking in production.
 */

import { Router } from "express";
// Import as DEFAULT to match project usage elsewhere (app.js uses `import authenticate from ...`)
import authenticate from "../middleware/authenticate.js";
import { getDiscover /*, handleAction */ } from "../controllers/discoverController.js";

// ----------------------------------------------------------------------------
// Router instance
// ----------------------------------------------------------------------------
const router = Router();

/**
 * Optional local helpers (no external deps)
 * These are kept minimal and internal to this router file. They do not alter
 * controller behavior; they exist purely to keep the file informative and
 * future-proof for small extensibility needs.
 */

/** Simple boolean-ish parser (supports '1'/'true'/1/true) */
function isTruthy(v) {
  return v === true || v === 1 || v === "1" || (typeof v === "string" && v.toLowerCase() === "true");
}

/**
 * DEV Diagnostics: /__warming
 * ----------------------------------------------------------------------------
 * Why:
 *   - During integration and CI, it is often useful to verify that the router
 *     is mounted and reachable before hitting the secured endpoints.
 * Guard:
 *   - Only enabled when NODE_ENV !== 'production'
 * Usage:
 *   curl -i http://localhost:5000/api/discover/__warming
 */
if (process.env.NODE_ENV !== "production") {
  router.get("/__warming", (_req, res) => {
    res.status(200).json({
      ok: true,
      route: "/api/discover/__warming",
      env: process.env.NODE_ENV || "development",
      tip: "This is a dev-only probe. The real endpoint is GET /api/discover (authenticated).",
    });
  });
}

/**
 * Middleware chain placeholder
 * ----------------------------------------------------------------------------
 * If you later need light query validation or per-route rate limits,
 * insert middlewares here (before `authenticate` if they do not require user,
 * after `authenticate` if they rely on req.user).
 *
 * Example (commented, no-op):
 *
 * function validateDiscoverQuery(req, _res, next) {
 *   // Example: gently normalize boolean-like toggles without rejecting requests
 *   const q = req.query || {};
 *   if ("includeSelf" in q) q.includeSelf = isTruthy(q.includeSelf);
 *   if ("includeHidden" in q) q.includeHidden = isTruthy(q.includeHidden);
 *   // Keep everything else as-is; controller contains the authoritative logic.
 *   return next();
 * }
 */

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

/**
 * GET /api/discover
 * Secure listing endpoint; returns `{ users, meta }`.
 * - Auth: required (authenticate)
 * - Query: includeSelf, includeHidden, paging, optional filters (interpreted by controller)
 */
router.get(
  "/",
  // validateDiscoverQuery, // (optional) keep commented; controller already robust
  authenticate,
  getDiscover
);

/**
 * (Optional) Actions endpoint — keep commented unless FE uses it.
 * If you enable this later, ensure rate limits & quotas at controller/service level.
 *
 * POST /api/discover/:userId/:actionType
 *  - actionType ∈ { like | pass | superlike }
 *  - Auth required
 */
// router.post("/:userId/:actionType", authenticate, handleAction);

// ----------------------------------------------------------------------------
// Export
// ----------------------------------------------------------------------------
export default router;
// --- REPLACE END ---


