// PATH: server/src/routes/superlike.js

// --- REPLACE START: Unified Superlike router (supports both /:id and body alias) ---
'use strict';

import express from 'express';

const router = express.Router();

/**
 * AUTH NOTE:
 * Prefer mounting authentication at app level, e.g.:
 *   import authenticate from '../middleware/authenticate.js';
 *   app.use('/api/superlike', authenticate, router);   // path param
 *   app.use('/api/superlikes', authenticate, router);  // plural alias to the same router
 *
 * This single router already supports BOTH:
 *   - POST /api/superlike/:id           (path param)
 *   - POST /api/superlikes  {id|userId|targetUserId} (body alias)
 *
 * If you also keep a file at routes/superlikes.js, it should simply re-export this router:
 *   import router from './superlike.js'; export default router;
 */

// ──────────────────────────────────────────────────────────────────────────────
// Lazy-load superlike controller (supports default and named exports)
// Location: server/src/controllers/superlikeController.js
// ──────────────────────────────────────────────────────────────────────────────
let LoadedCtrl = null;
async function getSuperlikeCtrl() {
  if (LoadedCtrl) return LoadedCtrl;
  try {
    const mod = await import('../controllers/superlikeController.js');
    // Accept default export (callable middleware) OR a named handler
    LoadedCtrl =
      mod?.superlikeUser || // named
      mod?.default ||       // default middleware
      mod?.superlike ||     // alt name
      mod?.create ||        // some routers export create()
      null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[superlike route] Failed to load controller:', e?.message || e);
    LoadedCtrl = null;
  }
  return LoadedCtrl;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
/** Simple ObjectId format check without pulling mongoose as a hard dep */
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

async function loadUserModel() {
  // Prefer real app model path outside src, then fallback to src
  try {
    const m = await import('../../models/User.js'); // server/models/User.js
    return m?.default || m?.User || m || null;
  } catch {
    try {
      const m = await import('../models/User.js'); // server/src/models/User.js
      return m?.default || m?.User || m || null;
    } catch {
      return null;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
/**
 * Validate target user for POST /:id
 *  - Accepts either :id or :targetId param (both supported)
 *  - 400 if missing or malformed
 *  - 404 if User model is available and the user does not exist (best-effort)
 * NOTE: If your project has a dedicated validator, you can swap this out safely.
 */
async function validateTargetParam(req, res, next) {
  try {
    const { id, targetId } = req.params || {};
    const target = id ?? targetId;

    if (!target) {
      return res.status(400).json({ error: 'targetId is required' });
    }
    if (!isValidObjectId(target)) {
      return res.status(400).json({ error: 'Invalid targetId format (expected 24-hex ObjectId)' });
    }

    // Optional: existence check (best-effort) — skip if model not resolvable
    try {
      const UserModel = await loadUserModel();
      if (UserModel && typeof UserModel.findById === 'function') {
        const exists = await UserModel.findById(target).select('_id').lean();
        if (!exists) return res.status(404).json({ error: 'Target user not found' });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[superlike route] Skipping existence check (param):', e?.message || e);
    }

    return next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[superlike route] validateTargetParam error:', err?.message || err);
    return res.status(500).json({ error: 'Internal validation error' });
  }
}

/**
 * Validate body `{ targetUserId | targetId | id }` for POST /
 * Mirrors the rules of validateTargetParam, but reads from body.
 * Also normalizes `req.params.id` so the controller can read a single place.
 */
async function validateTargetBody(req, res, next) {
  try {
    const body = req?.body || {};
    const target = body.targetUserId ?? body.targetId ?? body.id;

    if (!target) {
      return res.status(400).json({ error: 'Body must include targetUserId (or targetId/id)' });
    }
    if (!isValidObjectId(target)) {
      return res.status(400).json({ error: 'Invalid targetId format (expected 24-hex ObjectId)' });
    }

    // Optional best-effort existence check
    try {
      const UserModel = await loadUserModel();
      if (UserModel && typeof UserModel.findById === 'function') {
        const exists = await UserModel.findById(target).select('_id').lean();
        if (!exists) return res.status(404).json({ error: 'Target user not found' });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[superlike route] Skipping existence check (body):', e?.message || e);
    }

    // Normalize for controller: prefer req.params.id
    req.params = req.params || {};
    req.params.id = target;

    return next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[superlike route] validateTargetBody error:', err?.message || err);
    return res.status(500).json({ error: 'Internal validation error' });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ROUTES
// This single router supports BOTH forms, so you can mount it at both bases:
//   app.use('/api/superlike', authenticate, router);   // path param
//   app.use('/api/superlikes', authenticate, router);  // body alias
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Path form:
 *   POST /api/superlike/:id
 *   POST /api/superlike/:targetId
 */
router.post('/:id', validateTargetParam, async (req, res, next) => {
  try {
    const handler = await getSuperlikeCtrl();
    if (typeof handler === 'function') {
      return handler(req, res, next);
    }
    // Fallback minimal behavior if controller not found
    const { id, targetId } = req.params || {};
    const target = id ?? targetId;
    return res.json({ ok: true, superliked: target });
  } catch (err) {
    return next(err);
  }
});

/**
 * Body form (plural alias base):
 *   Mounted as: POST /api/superlikes   with JSON body: { "targetUserId": "<ObjectId>" }
 *   We also accept { "targetId": ... } or { "id": ... } for flexibility.
 */
router.post('/', validateTargetBody, async (req, res, next) => {
  try {
    const handler = await getSuperlikeCtrl();
    if (typeof handler === 'function') {
      return handler(req, res, next);
    }
    // Fallback minimal behavior if controller not found
    const { id } = req.params || {};
    return res.json({ ok: true, superliked: id });
  } catch (err) {
    return next(err);
  }
});

// --- REPLACE END ---

export default router;


