// File: server/src/routes/likes.js

// --- REPLACE START: Likes routes (ESM, auth protected, with target validation) ---
'use strict';

import express from 'express';
import authenticate from '../middleware/authenticate.js';

// ──────────────────────────────────────────────────────────────────────────────
// Lazy-load likes controller (supports both default and named exports)
// ──────────────────────────────────────────────────────────────────────────────
let LikesCtrl = null;
async function getLikesCtrl() {
  if (LikesCtrl) return LikesCtrl;
  try {
    // From server/src/routes → server/controllers
    const mod = await import('../../controllers/likesController.js');
    LikesCtrl = mod?.default || mod || {};
  } catch (e) {
    console.error('[likes routes] Failed to load likesController.js:', e?.message || e);
    LikesCtrl = {};
  }
  return LikesCtrl;
}

// ──────────────────────────────────────────────────────────────────────────────
/**
 * Lightweight ObjectId check (avoid pulling mongoose here).
 * We keep this conservative to not reject valid 24-hex strings.
 */
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Validate target user for POST /:targetId
 *  - 400 if missing or malformed ObjectId
 *  - 404 if user model exists AND user not found
 *  - If the User model cannot be loaded, we log and continue (best-effort).
 */
async function validateTargetUser(req, res, next) {
  try {
    const { targetId } = req.params || {};
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' });
    }
    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ error: 'Invalid targetId format (expected 24-hex ObjectId)' });
    }

    // Best-effort existence check; do not hard fail if model not available.
    try {
      // From server/src/routes → server/src/models OR server/models depending on your layout.
      // Prefer the real app model in ../../models/User.js first (outside src if that’s your structure).
      let UserModel = null;
      try {
        const mod = await import('../../models/User.js'); // typical: server/models/User.js
        UserModel = mod?.default || mod?.User || mod || null;
      } catch {
        // Fallback: try inside src if models live there
        const mod = await import('../models/User.js'); // server/src/models/User.js
        UserModel = mod?.default || mod?.User || mod || null;
      }

      if (UserModel && typeof UserModel.findById === 'function') {
        const exists = await UserModel.findById(targetId).select('_id').lean();
        if (!exists) {
          return res.status(404).json({ error: 'Target user not found' });
        }
      }
      // If model could not be resolved, skip existence check silently.
    } catch (e) {
      // Log and continue to controller (controller may still validate).
      console.warn('[likes routes] User existence check skipped:', e?.message || e);
    }

    return next();
  } catch (err) {
    console.warn('[likes routes] validateTargetUser error:', err?.message || err);
    return res.status(500).json({ error: 'Internal validation error' });
  }
}

const router = express.Router();

/**
 * Mount examples (in app.js):
 *   import likesRoutes from './routes/likes.js';
 *   app.use('/api/likes', likesRoutes);
 */

// Create a like (idempotent in controller), with target validation
router.post('/:targetId', authenticate, validateTargetUser, async (req, res) => {
  const c = await getLikesCtrl();
  return typeof c.likeUser === 'function'
    ? c.likeUser(req, res)
    : res.status(501).json({ error: 'likesController.likeUser not available' });
});

// Remove a like (keep idempotent; do NOT 404 if target is unknown)
// We intentionally do not attach validateTargetUser here to preserve idempotency.
router.delete('/:targetId', authenticate, async (req, res) => {
  const c = await getLikesCtrl();
  return typeof c.unlikeUser === 'function'
    ? c.unlikeUser(req, res)
    : res.status(501).json({ error: 'likesController.unlikeUser not available' });
});

// Lists
router.get('/outgoing', authenticate, async (req, res) => {
  const c = await getLikesCtrl();
  const fn = c.getOutgoing || c.listOutgoingLikes;
  return typeof fn === 'function'
    ? fn(req, res)
    : res.status(501).json({ error: 'likesController.getOutgoing not available' });
});

router.get('/incoming', authenticate, async (req, res) => {
  const c = await getLikesCtrl();
  const fn = c.getIncoming || c.listIncomingLikes;
  return typeof fn === 'function'
    ? fn(req, res)
    : res.status(501).json({ error: 'likesController.getIncoming not available' });
});

router.get('/matches', authenticate, async (req, res) => {
  const c = await getLikesCtrl();
  const fn = c.getMatches || c.listMatches;
  return typeof fn === 'function'
    ? fn(req, res)
    : res.status(501).json({ error: 'likesController.getMatches not available' });
});

// --- REPLACE END ---

export default router;
