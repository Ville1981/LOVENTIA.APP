// --- REPLACE START: ESM discover router (single mount, safe fallbacks, normalized output, no unnecessary shortening) ---
/**
 * Discover Routes (ESM)
 * =============================================================================
 * Purpose:
 *   • Provide a single, clean Router for `/api/discover`.
 *   • Delegate to `getDiscover` controller when available.
 *   • Keep output shape consistent and user objects normalized for the FE.
 *   • Offer safe fallback behavior if the controller is missing/throws.
 *
 * Mounting (app.js):
 *   // If you mount the ESM router directly:
 *   import discoverRouter from './routes/discoverRoutes.js';
 *   app.use('/api/discover', discoverRouter);
 *
 *   // If you use the CJS shim at ./routes/discover.js, it will attach this router automatically.
 *
 * Security:
 *   • Auth is enforced via `authenticate` middleware at route level.
 *
 * Output contract:
 *   • GET "/" → 200 JSON: { users: User[], meta: {...} }
 *     - `users` is always an array (possibly empty).
 *     - `meta` contains paging fields and may include flags like includeSelf/includeHidden
 *       when provided by the controller. Fallback ensures at least page/limit/total.
 *
 * Notes:
 *   • All comments in English as requested.
 *   • No new dependencies introduced.
 *   • Exports both `default` and named `router` (compat with any shim expecting either).
 */

'use strict';

import express from 'express';
import authenticate from '../middleware/authenticate.js';

// Controller (preferred path). If missing, we fall back gracefully.
import * as DiscoverController from '../controllers/discoverController.js';

// Normalizers (ensure arrays, strip sensitive fields, POSIX paths, stable id)
import normalizeUserOut, { normalizeUsersOut } from '../utils/normalizeUserOut.js';

// Optional: used only in fallback branch (includeSelf=1) to load current user
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

// ----------------------------------------------------------------------------
// Router instance
// ----------------------------------------------------------------------------
const router = express.Router();

/** Tiny helper: boolean-like parser for query toggles ('1'/'true'/1/true). */
function isTruthy(v) {
  return v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
}

/**
 * DEV probe endpoint (guarded): /api/discover/__warming
 * ----------------------------------------------------------------------------
 * Useful to verify mount during integration. Not exposed in production.
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/__warming', (_req, res) => {
    res.status(200).json({
      ok: true,
      route: '/api/discover/__warming',
      env: process.env.NODE_ENV || 'development',
      tip: 'Real endpoint is GET /api/discover (authenticated).',
    });
  });
}

/**
 * GET /api/discover
 * ----------------------------------------------------------------------------
 * Primary discovery feed.
 * - Delegates to controller.getDiscover when available.
 * - Normalizes outbound user objects (photos/paths/ids) without altering controller logic.
 * - If controller is missing or errors before writing a response, returns a minimal,
 *   explicit fallback payload (empty feed; optionally includes the current user when includeSelf=1).
 */
router.get(
  '/',
  authenticate,
  async (req, res, next) => {
    // Bind original res.json to safely wrap normalization without breaking Express internals
    const originalJson = res.json.bind(res);

    let responded = false;
    res.json = (payload) => {
      try {
        // Normalize common shapes from the controller:
        if (Array.isArray(payload)) {
          responded = true;
          return originalJson(normalizeUsersOut(payload));
        }
        if (payload && Array.isArray(payload.users)) {
          const normalized = { ...payload, users: normalizeUsersOut(payload.users) };
          responded = true;
          return originalJson(normalized);
        }
        if (payload && typeof payload === 'object' && payload._id && !payload.users) {
          // Single user object case
          responded = true;
          return originalJson(normalizeUserOut(payload));
        }
      } catch {
        // On any normalization error, fall through to raw payload to avoid masking issues
      }
      responded = true;
      return originalJson(payload);
    };

    try {
      // Prefer the named export `getDiscover`; accept default (function) as a fallback.
      const handler =
        (typeof DiscoverController.getDiscover === 'function' && DiscoverController.getDiscover) ||
        (typeof DiscoverController.default === 'function' && DiscoverController.default) ||
        null;

      if (handler) {
        await handler(req, res, next);
        if (responded) return; // Controller produced a response (normalized by our wrapper)
      }
    } catch (err) {
      // Log and continue to fallback only if nothing has been sent yet
      try {
        // eslint-disable-next-line no-console
        console.error('[discoverRoutes] controller error (falling back):', err?.message || err);
      } catch {}
      if (responded) return; // If controller already wrote, honor it
    }

    // --- Fallback path (controller missing or did not respond) ----------------
    try {
      const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '24', 10) || 24));
      const includeSelf = isTruthy(req.query.includeSelf);

      const usersOut = [];

      if (includeSelf) {
        // Try to include the current user if auth middleware populated req.user/req.userId
        const currentUserId =
          req.userId ||
          req?.user?.userId ||
          req?.user?.id ||
          (req?.user?._id && String(req.user._id)) ||
          null;

        if (currentUserId && User?.findById) {
          try {
            const me = await User.findById(String(currentUserId)).lean();
            if (me) usersOut.push(normalizeUserOut(me));
          } catch {
            /* non-fatal in fallback */
          }
        }
      }

      const meta = {
        page,
        limit,
        total: usersOut.length,
        pageCount: usersOut.length ? 1 : 0,
        hasPrev: page > 1,
        hasNext: false,
        // In fallback we at least echo includeSelf for FE debuggability
        includeSelf,
      };

      return res.status(200).json({ users: usersOut, meta });
    } catch (e) {
      return next(e);
    }
  }
);

// ----------------------------------------------------------------------------
// Exports (keep both for compatibility with any loader/shim combo)
// ----------------------------------------------------------------------------
export { router };
export default router;

// --- REPLACE END ---



