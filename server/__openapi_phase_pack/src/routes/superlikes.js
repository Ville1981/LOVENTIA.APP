// File: server/src/routes/superlikes.js

// --- REPLACE START: Superlikes alias route with body id validation ---
'use strict';

import express from 'express';

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Lazy import the single-action router (/api/superlike/:id)
// ──────────────────────────────────────────────────────────────────────────────
let singleRouter = null;
async function getSingleRouter() {
  if (singleRouter) return singleRouter;
  try {
    const mod = await import('./superlike.js');
    singleRouter = mod?.default || mod || null;
  } catch (e) {
    console.error('[superlikes alias] Failed to load ./superlike.js:', e?.message || e);
    singleRouter = null;
  }
  return singleRouter;
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ──────────────────────────────────────────────────────────────────────────────
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
// POST /  (alias to POST /superlike/:id when body contains { id } or { userId })
//  - Validates ObjectId format
//  - 404 if user model exists and user is not found
//  - On success, keeps existing response shape { ok: true, superliked: id }
//  - If single route is available, forwards the request to it
// ──────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const body = (req && req.body) || {};
    const id = body.id || body.userId;

    if (!id) {
      return res.status(400).json({ error: "Body must include 'id' (or 'userId')." });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id format (expected 24-hex ObjectId).' });
    }

    // Best-effort existence check
    try {
      const User = await loadUserModel();
      if (User && typeof User.findById === 'function') {
        const exists = await User.findById(id).select('_id').lean();
        if (!exists) {
          return res.status(404).json({ error: 'Target user not found.' });
        }
      } else {
        console.warn('[superlikes alias] User model unavailable, skipping existence check.');
      }
    } catch (e) {
      console.warn('[superlikes alias] Existence check skipped:', e?.message || e);
    }

    // If the single-route router is available, forward to it so logic stays in one place
    const r = await getSingleRouter();
    if (r && typeof r.handle === 'function') {
      // Rewrite URL to look like /:id and hand off to the child router
      req.url = `/${encodeURIComponent(id)}`;
      return r.handle(req, res, next);
    }

    // Fallback: return minimal success payload
    return res.json({ ok: true, superliked: id });
  } catch (err) {
    return next(err);
  }
});

// Keep delegating the rest to the single router (e.g., future GETs if any)
router.use('/', async (req, res, next) => {
  try {
    const r = await getSingleRouter();
    if (r) return r(req, res, next);
    return next();
  } catch (err) {
    return next(err);
  }
});

// --- REPLACE END ---

export default router;
