// PATH: server/src/routes/likes.js
// --- REPLACE START: Likes routes (ESM, auth protected, with target validation & body POST '/') ---
'use strict';

import express from 'express';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

/**
 * Mount examples (in app.js):
 *   import likesRouter from './routes/likes.js';
 *   app.use('/api/likes', authenticate, likesRouter);
 *
 * This router supports both:
 *   1) POST /           with JSON body { targetUserId: "<24-hex>" }
 *   2) POST /:targetId  legacy path param
 *
 * On a successful like, we *attempt* to push the action onto the rewind stack.
 * We try multiple controller entrypoints to stay compatible across repo layouts.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Lazy-load likes controller (supports both src/ and project-root controllers)
// ──────────────────────────────────────────────────────────────────────────────
let LikesCtrl = null;
async function getLikesCtrl() {
  if (LikesCtrl) return LikesCtrl;
  try {
    // Prefer canonical location
    const mod = await import('../controllers/likesController.js');
    LikesCtrl = mod?.default || mod || {};
    return LikesCtrl;
  } catch (e1) {
    try {
      // Fallback to legacy layout
      const mod2 = await import('../../controllers/likesController.js');
      LikesCtrl = mod2?.default || mod2 || {};
      return LikesCtrl;
    } catch (e2) {
      console.error(
        '[likes routes] Failed to load likesController.js:',
        e1?.message || e1,
        '| fallback:',
        e2?.message || e2
      );
      LikesCtrl = {};
      return LikesCtrl;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Lazy-load rewind controller/service (best-effort, optional)
// ──────────────────────────────────────────────────────────────────────────────
let RewindCtrl = null;
async function getRewindCtrl() {
  if (RewindCtrl) return RewindCtrl;
  try {
    const mod = await import('../controllers/rewindController.js');
    RewindCtrl = mod?.default || mod || {};
    return RewindCtrl;
  } catch (e1) {
    try {
      const mod2 = await import('../../controllers/rewindController.js');
      RewindCtrl = mod2?.default || mod2 || {};
      return RewindCtrl;
    } catch {
      // Keep silent in normal flow; not all repos have a dedicated rewind controller.
      RewindCtrl = {};
      return RewindCtrl;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
/**
 * Lightweight ObjectId check (avoid importing mongoose in the router).
 */
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

// ──────────────────────────────────────────────────────────────────────────────
// Lazy User model resolver (used by validation + rewind push)
// ──────────────────────────────────────────────────────────────────────────────
let UserModelCached = null;
let triedLoadUserModel = false;

async function getUserModel() {
  if (UserModelCached || triedLoadUserModel) return UserModelCached;
  triedLoadUserModel = true;

  try {
    // Legacy location: server/models/User.js
    const modLegacy = await import('../../models/User.js');
    UserModelCached = modLegacy?.default || modLegacy?.User || modLegacy || null;
    if (UserModelCached) return UserModelCached;
  } catch {
    // ignore and try src layout
  }

  try {
    // Current location: server/src/models/User.js
    const mod = await import('../models/User.js');
    UserModelCached = mod?.default || mod?.User || mod || null;
  } catch {
    UserModelCached = null;
  }

  return UserModelCached;
}

/**
 * Validate target user existence (best-effort; does not hard-fail if model missing).
 */
async function validateTargetUserExists(targetId) {
  const UserModel = await getUserModel();
  if (!UserModel || typeof UserModel.findById !== 'function') return true; // skip if unavailable
  const exists = await UserModel.findById(targetId).select('_id').lean();
  return !!exists;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers to normalize target id from body or params
// ──────────────────────────────────────────────────────────────────────────────
function getTargetIdFromReq(req) {
  const bodyId =
    req.body?.targetUserId ??
    req.body?.targetId ??
    req.body?.userId ??
    req.body?.id ??
    null;
  return req.params?.targetId || bodyId || null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Best-effort rewind push after a successful like (non-blocking if possible).
// We try a few controller methods for wide compatibility.
// Finally, we have a direct DB fallback that writes into rewind.stack.
// ──────────────────────────────────────────────────────────────────────────────
async function pushRewindBestEffort(req, resultPayload) {
  try {
    const c = await getLikesCtrl();
    const r = await getRewindCtrl();

    // Prefer a dedicated rewind controller if available
    if (typeof r?.pushLikeAction === 'function') {
      await r.pushLikeAction(req, resultPayload);
      return true;
    }
    if (typeof r?.recordAction === 'function') {
      await r.recordAction(req, { type: 'like', payload: resultPayload || {} });
      return true;
    }

    // Fallbacks exposed by likes controller itself
    if (typeof c?.pushRewind === 'function') {
      await c.pushRewind(req, resultPayload);
      return true;
    }
    if (typeof c?.recordLikeForRewind === 'function') {
      await c.recordLikeForRewind(req, resultPayload);
      return true;
    }

    // As a final controller-level fallback, emit an app event if such bus exists.
    const bus = req.app?.get?.('rewindBus');
    if (bus && typeof bus.emit === 'function') {
      bus.emit('rewind:like', {
        userId: req.userId || req.auth?.userId || req.auth?.id,
        targetUserId: getTargetIdFromReq(req),
        at: Date.now(),
      });
      return true;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // HARD FALLBACK: write directly to User.rewind.stack
    // This guarantees that /api/likes will always push something the
    // /api/rewind endpoint can see, even if controllers do nothing.
    // ──────────────────────────────────────────────────────────────────────────
    const UserModel = await getUserModel();
    const userId =
      req.userId ||
      req.user?.id ||
      req.user?._id ||
      req.auth?.userId ||
      req.auth?.id ||
      null;

    const targetUserId =
      getTargetIdFromReq(req) ||
      resultPayload?.targetUserId ||
      resultPayload?.targetId ||
      null;

    if (
      UserModel &&
      typeof UserModel.updateOne === 'function' &&
      userId &&
      targetUserId &&
      isValidObjectId(targetUserId)
    ) {
      const now = new Date();
      const actionDoc = {
        type: 'like',
        action: 'like',
        targetUserId,
        targetId: targetUserId,
        target: targetUserId,
        createdAt: now,
        at: now,
        source: 'likesRoute',
      };

      const query = UserModel.updateOne(
        { _id: userId },
        {
          $push: { 'rewind.stack': actionDoc },
        }
      );

      if (typeof query.exec === 'function') {
        await query.exec();
      } else {
        await query;
      }

      return true;
    }
  } catch (e) {
    // Never block on rewind push; just log as debug.
    console.warn('[likes routes] pushRewindBestEffort warning:', e?.message || e);
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Route: POST /  { targetUserId }
// - Validates input
// - Delegates to controller likeUser (via params adapter)
// - Ensures best-effort rewind push
// - Returns 200/201 or 409 for idempotent no-op
// ──────────────────────────────────────────────────────────────────────────────
router.post('/', authenticate, express.json(), async (req, res) => {
  try {
    const targetId = getTargetIdFromReq(req);
    if (!targetId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }
    if (!isValidObjectId(targetId)) {
      return res
        .status(400)
        .json({ error: 'Invalid targetUserId format (expected 24-hex ObjectId)' });
    }

    // Optional existence check (best-effort)
    const exists = await validateTargetUserExists(targetId);
    if (!exists) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Adapt body → params so existing controllers (likeUser) work unchanged
    req.params = { ...(req.params || {}), targetId };

    const c = await getLikesCtrl();

    // Prefer a single-call controller if present
    if (typeof c?.likeAndPush === 'function') {
      return c.likeAndPush(req, res);
    }

    // Fallback: call likeUser and then attempt rewind push when the response finishes
    if (typeof c?.likeUser === 'function') {
      // Intercept completion to push rewind even if controller writes response itself
      let pushed = false;
      const onFinish = async () => {
        if (pushed) return;
        pushed = true;
        try {
          await pushRewindBestEffort(req, { targetUserId: targetId });
        } catch {
          // ignore
        }
      };
      res.once('finish', onFinish);

      // If the controller returns a promise, await it (for better ordering)
      const maybePromise = c.likeUser(req, res);
      if (maybePromise && typeof maybePromise.then === 'function') {
        try {
          await maybePromise;
        } catch {
          // Controller handled the response; ensure our finish hook will still run.
        }
      }
      return; // Controller owns the response
    }

    // As a last resort: explicit 501 if controller is missing
    return res.status(501).json({ error: 'likesController.likeUser not available' });
  } catch (err) {
    console.error('[likes routes] POST / error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Legacy path: POST /:targetId  (kept for backward compatibility)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/:targetId', authenticate, async (req, res) => {
  const targetId = req.params?.targetId;
  if (!targetId) return res.status(400).json({ error: 'targetId is required' });
  if (!isValidObjectId(targetId)) {
    return res
      .status(400)
      .json({ error: 'Invalid targetId format (expected 24-hex ObjectId)' });
  }

  // Optional existence check (best-effort)
  try {
    const exists = await validateTargetUserExists(targetId);
    if (!exists) return res.status(404).json({ error: 'Target user not found' });
  } catch {
    // ignore existence errors
  }

  const c = await getLikesCtrl();

  // Prefer combined controller if available
  if (typeof c?.likeAndPush === 'function') {
    return c.likeAndPush(req, res);
  }

  if (typeof c?.likeUser === 'function') {
    let pushed = false;
    const onFinish = async () => {
      if (pushed) return;
      pushed = true;
      try {
        await pushRewindBestEffort(req, { targetUserId: targetId });
      } catch {
        // ignore
      }
    };
    res.once('finish', onFinish);

    const maybePromise = c.likeUser(req, res);
    if (maybePromise && typeof maybePromise.then === 'function') {
      try {
        await maybePromise;
      } catch {
        // controller will have handled response
      }
    }
    return;
  }

  return res.status(501).json({ error: 'likesController.likeUser not available' });
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /:targetId — idempotent unlike (do not 404 if already absent)
// ──────────────────────────────────────────────────────────────────────────────
router.delete('/:targetId', authenticate, async (req, res) => {
  const c = await getLikesCtrl();
  return typeof c?.unlikeUser === 'function'
    ? c.unlikeUser(req, res)
    : res.status(501).json({ error: 'likesController.unlikeUser not available' });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /outgoing | /incoming | /matches — lists (keep legacy function names)
// ──────────────────────────────────────────────────────────────────────────────
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

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.
// --- REPLACE END ---

export default router;


