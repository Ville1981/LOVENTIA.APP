// --- REPLACE START: Likes routes (ESM, auth protected, with target validation) ---
'use strict';

import express from 'express';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

/**
 * Mount examples (in app.js):
 *   import likesRoutes from './routes/likes.js';
 *   app.use('/api/likes', likesRoutes);
 */

// ──────────────────────────────────────────────────────────────────────────────
// Lazy-load likes controller (supports both src/ and project-root controllers)
// ──────────────────────────────────────────────────────────────────────────────
let LikesCtrl = null;
async function getLikesCtrl() {
  if (LikesCtrl) return LikesCtrl;
  try {
    // Prefer src controller (this repo’s canonical location)
    const mod = await import('../controllers/likesController.js');
    LikesCtrl = mod?.default || mod || {};
    return LikesCtrl;
  } catch (e1) {
    try {
      // Fallback to project root (legacy layout)
      const mod2 = await import('../../controllers/likesController.js');
      LikesCtrl = mod2?.default || mod2 || {};
      return LikesCtrl;
    } catch (e2) {
      console.error(
        '[likes routes] Failed to load likesController.js:',
        (e1?.message || e1),
        '| fallback:',
        (e2?.message || e2)
      );
      LikesCtrl = {};
      return LikesCtrl;
    }
  }
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
      // Try project-root models first (legacy), then src/models (current).
      let UserModel = null;
      try {
        const mod = await import('../../models/User.js'); // server/models/User.js (legacy root)
        UserModel = mod?.default || mod?.User || mod || null;
      } catch {
        const mod = await import('../models/User.js'); // server/src/models/User.js (current)
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
      console.warn('[likes routes] User existence check skipped:', e?.message || e);
    }

    return next();
  } catch (err) {
    console.warn('[likes routes] validateTargetUser error:', err?.message || err);
    return res.status(500).json({ error: 'Internal validation error' });
  }
}

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

