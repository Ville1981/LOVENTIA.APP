// PATH: server/src/routes/discoverRoutes.js

// --- REPLACE START: ESM discover router (single mount, safe fallbacks, normalized output, devFixture support) ---
/**
 * Discover Routes (ESM)
 * =============================================================================
 * Purpose:
 *   • Provide a single, clean Router for `/api/discover`.
 *   • Delegate to `getDiscover` controller when available.
 *   • Keep output shape consistent and user objects normalized for the FE.
 *   • Offer safe fallback / dev-fixture behavior if the controller is missing/throws.
 *
 * Mounting (app.js):
 *   // ESM router:
 *   import discoverRouter from './routes/discoverRoutes.js';
 *   app.use('/api/discover', discoverRouter);
 *
 *   // If you use the CJS shim at ./routes/discover.js, it can attach this router automatically.
 *
 * Security:
 *   • Auth is enforced via `authenticate` middleware at route level.
 *
 * Output contract (for FE and PS scripts):
 *   • GET "/" → 200 JSON: { data: User[], meta: {...} }
 *     - `data` is always an array (possibly empty).
 *     - `meta` contains paging fields and may include flags like includeSelf/devFixture
 *       when provided by the controller or by this router.
 *
 *   • Internally we also understand shapes with `users`:
 *     - Controller may return { users: [...] } → router rewrites to { data: [...] }.
 *     - A plain array (`[...]`) is rewritten to { data: [...] }.
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

// Optional: used for fallback + devFixture modes to load users directly
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Tiny helper: boolean-like parser for query toggles ('1'/'true'/1/true). */
function isTruthy(v) {
  return (
    v === true ||
    v === 1 ||
    v === '1' ||
    (typeof v === 'string' && v.toLowerCase() === 'true')
  );
}

/** Parse a positive integer with sane default and bounds. */
function parsePositiveInt(value, defaultValue, min = 1, max = 100) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < min) return defaultValue;
  if (n > max) return max;
  return n;
}

/** Extract current user id (string) from request populated by `authenticate`. */
function getCurrentUserId(req) {
  const direct =
    req.userId ||
    req?.user?.userId ||
    req?.user?.id ||
    (req?.user?._id && String(req.user._id));
  return direct ? String(direct) : null;
}

// ----------------------------------------------------------------------------
// Router instance
// ----------------------------------------------------------------------------
const router = express.Router();

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
 * - Normal case:
 *   • Delegates to controller.getDiscover (or default export) when available.
 *   • Normalizes outbound user objects and output shape to { data: [...], meta }.
 *
 * - Dev-fixture mode (non-production only):
 *   • If `?devFixture=1` is present, we bypass the controller and return a simple,
 *     deterministic feed built directly from the `User` collection:
 *       - current user is excluded
 *       - result is { data: [...], meta: { ..., devFixture: true } }
 *
 * - Fallback mode:
 *   • If controller is missing or throws before writing a response, we return a minimal,
 *     explicit fallback payload (optionally including the current user when includeSelf=1).
 */
router.get('/', authenticate, async (req, res, next) => {
  // --------------------------------------------------------------------------
  // 0) Dev-fixture mode (non-production only, opt-in via ?devFixture=1)
  // --------------------------------------------------------------------------
  const isDevEnv = process.env.NODE_ENV !== 'production';
  const devFixtureRequested = isDevEnv && isTruthy(req.query.devFixture);

  if (devFixtureRequested && User && typeof User.find === 'function') {
    try {
      const page = parsePositiveInt(req.query.page || '1', 1, 1, 1000);
      const limit = parsePositiveInt(req.query.limit || '24', 24, 1, 100);
      const currentUserId = getCurrentUserId(req);

      const query = currentUserId
        ? { _id: { $ne: currentUserId } }
        : {};

      const docs = await User.find(query)
        .limit(limit)
        .lean();

      const normalized = normalizeUsersOut(Array.isArray(docs) ? docs : []);
      const total = normalized.length;

      const meta = {
        page,
        limit,
        total,
        pageCount: total ? 1 : 0,
        hasPrev: page > 1,
        hasNext: false,
        devFixture: true,
      };

      return res.status(200).json({
        data: normalized,
        meta,
      });
    } catch (err) {
      try {
        // eslint-disable-next-line no-console
        console.error('[discoverRoutes] devFixture mode failed, falling back:', err?.message || err);
      } catch {
        // ignore logging errors
      }
      // If dev-fixture branch fails, continue to normal controller path below.
    }
  }

  // --------------------------------------------------------------------------
  // 1) Wrap res.json to normalize shapes from controller
  // --------------------------------------------------------------------------
  const originalJson = res.json.bind(res);
  let responded = false;

  res.json = (payload) => {
    try {
      // Case A: plain array → wrap as { data: [...] }
      if (Array.isArray(payload)) {
        const normalizedArray = normalizeUsersOut(payload);
        responded = true;
        return originalJson({ data: normalizedArray, meta: { total: normalizedArray.length } });
      }

      // Case B: { users: [...] } → convert to { data: [...] } (keep users for backwards compatibility)
      if (payload && Array.isArray(payload.users)) {
        const normalizedUsers = normalizeUsersOut(payload.users);
        const merged = {
          ...payload,
          data: normalizedUsers,
          // keep `users` as-is so any old client that expects it does not break
          users: normalizedUsers,
        };
        responded = true;
        return originalJson(merged);
      }

      // Case C: single user object with _id → normalize and wrap into data:[user]
      if (payload && typeof payload === 'object' && payload._id && !payload.data && !payload.users) {
        const normalizedUser = normalizeUserOut(payload);
        responded = true;
        return originalJson({ data: [normalizedUser], meta: { total: 1 } });
      }
    } catch {
      // On any normalization error, fall through to raw payload to avoid masking issues
    }

    // Default: pass through untouched (e.g. existing { data, meta } shape)
    responded = true;
    return originalJson(payload);
  };

  // --------------------------------------------------------------------------
  // 2) Normal controller path (preferred)
  // --------------------------------------------------------------------------
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
    } catch {
      // ignore logging errors
    }
    if (responded) return; // If controller already wrote, honor it
  }

  // --------------------------------------------------------------------------
  // 3) Fallback path (controller missing or did not respond)
  // --------------------------------------------------------------------------
  try {
    const page = parsePositiveInt(req.query.page || '1', 1, 1, 1000);
    const limit = parsePositiveInt(req.query.limit || '24', 24, 1, 100);
    const includeSelf = isTruthy(req.query.includeSelf);

    const usersOut = [];

    if (includeSelf && User && typeof User.findById === 'function') {
      const currentUserId = getCurrentUserId(req);

      if (currentUserId) {
        try {
          const me = await User.findById(String(currentUserId)).lean();
          if (me) {
            usersOut.push(normalizeUserOut(me));
          }
        } catch {
          // non-fatal in fallback
        }
      }
    }

    const total = usersOut.length;
    const meta = {
      page,
      limit,
      total,
      pageCount: total ? 1 : 0,
      hasPrev: page > 1,
      hasNext: false,
      includeSelf,
      fallback: true,
    };

    return res.status(200).json({ data: usersOut, meta });
  } catch (e) {
    return next(e);
  }
});

// ----------------------------------------------------------------------------
// Exports (keep both for compatibility with any loader/shim combo)
// ----------------------------------------------------------------------------
export { router };
export default router;

// --- REPLACE END ---

