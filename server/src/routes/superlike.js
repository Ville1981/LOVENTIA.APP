// File: server/src/routes/superlike.js

// --- REPLACE START: Single superlike route with target validation (ESM) ---
'use strict';

import express from 'express';

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Lazy-load superlike controller (supports default and named exports)
// Location: server/src/controllers/superlikeController.js
// ──────────────────────────────────────────────────────────────────────────────
let SuperlikeCtrl = null;
async function getSuperlikeCtrl() {
  if (SuperlikeCtrl) return SuperlikeCtrl;
  try {
    const mod = await import('../controllers/superlikeController.js');
    // Allow either default export (function) or a named handler
    SuperlikeCtrl = mod?.default || mod?.superlike || mod || null;
  } catch (e) {
    console.error('[superlike route] Failed to load superlikeController.js:', e?.message || e);
    SuperlikeCtrl = null;
  }
  return SuperlikeCtrl;
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation helpers (kept in-route to avoid extra deps)
// ──────────────────────────────────────────────────────────────────────────────
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Validate target user for POST /:id
 *  - Accepts either :id or :targetId param (both supported)
 *  - 400 if missing or malformed
 *  - 404 if User model is available and the user does not exist
 *  - If model cannot be resolved, we log a warning and continue (best-effort)
 * NOTE: Authentication is mounted at app-level (app.use("/api/superlike", authenticate, ...))
 */
async function validateTargetUser(req, res, next) {
  try {
    const { id, targetId } = req.params || {};
    const target = id ?? targetId;

    if (!target) {
      return res.status(400).json({ error: 'targetId is required' });
    }
    if (!isValidObjectId(target)) {
      return res.status(400).json({ error: 'Invalid targetId format (expected 24-hex ObjectId)' });
    }

    // Existence check (best-effort)
    try {
      // Prefer real app model path outside src, then fallback to src
      let UserModel = null;
      try {
        const mod = await import('../../models/User.js'); // server/models/User.js
        UserModel = mod?.default || mod?.User || mod || null;
      } catch {
        const mod = await import('../models/User.js'); // server/src/models/User.js
        UserModel = mod?.default || mod?.User || mod || null;
      }

      if (UserModel && typeof UserModel.findById === 'function') {
        const exists = await UserModel.findById(target).select('_id').lean();
        if (!exists) {
          return res.status(404).json({ error: 'Target user not found' });
        }
      }
      // If model not available, skip existence check.
    } catch (e) {
      console.warn('[superlike route] User existence check skipped:', e?.message || e);
    }

    return next();
  } catch (err) {
    console.warn('[superlike route] validateTargetUser error:', err?.message || err);
    return res.status(500).json({ error: 'Internal validation error' });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /:id → superlike a user (idempotent at controller layer)
// App-level will attach authenticate + roleAuthorize middlewares.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/:id', validateTargetUser, async (req, res, next) => {
  try {
    const handler = await getSuperlikeCtrl();
    if (typeof handler === 'function') {
      return handler(req, res, next);
    }
    // Fallback minimal behavior if controller is missing
    const { id } = req.params || {};
    return res.json({ ok: true, superliked: id });
  } catch (err) {
    return next(err);
  }
});

// --- REPLACE END ---

export default router;

