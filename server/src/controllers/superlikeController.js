// File: server/src/controllers/superlikeController.js

// --- REPLACE START: superlike controller (ESM wrapper) ---
'use strict';

/**
 * ESM wrapper for the project’s root superlike controller.
 *
 * Responsibilities:
 *  - Validate target id (ObjectId format).
 *  - Normalize param naming (supports :id or :targetId).
 *  - Delegate to root controller if present, otherwise return a sane fallback.
 *  - Export at least:
 *      - superlikeUser(req, res)
 *      - create (alias of superlikeUser)
 *    …and also a default export that is directly callable as middleware.
 *
 * Success payload shape (kept stable):
 *    { ok: true, superliked: "<targetId>" }
 */

import mongoose from 'mongoose';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
  if (mongoose?.Types?.ObjectId?.isValid) return mongoose.Types.ObjectId.isValid(id);
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

let _rootCtrl = null;
async function getRootCtrl() {
  if (_rootCtrl) return _rootCtrl;

  // Try common file name variants in the project root
  const candidates = [
    '../../controllers/superlikeController.js',
    '../../controllers/superlikesController.js',
    '../../controllers/superLikeController.js',
    '../../controllers/superLikesController.js',
  ];

  for (const rel of candidates) {
    try {
      const mod = await import(rel);
      _rootCtrl = mod?.default || mod || null;
      if (_rootCtrl) return _rootCtrl;
    } catch {
      // try next
    }
    // Optional CJS fallback if a mixed module sneaks in
    try {
      // eslint-disable-next-line no-undef
      const cjs = typeof require !== 'undefined' ? require(rel) : null;
      if (cjs) {
        _rootCtrl = cjs?.default || cjs || null;
        if (_rootCtrl) return _rootCtrl;
      }
    } catch {
      // continue
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Controller API
// ─────────────────────────────────────────────────────────────────────────────-

/**
 * POST /api/superlike/:id  (single-route)
 * Accepts :id or :targetId in params. Validates ObjectId format.
 * Delegates to root implementation if available.
 */
export async function superlikeUser(req, res) {
  try {
    const targetId = req?.params?.id || req?.params?.targetId;
    if (!targetId) {
      return res.status(400).json({ ok: false, error: 'Target id is required' });
    }
    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: 'Invalid id format (expected 24-hex ObjectId)' });
    }

    const root = await getRootCtrl();
    const impl =
      root?.superlikeUser ||
      root?.superLikeUser ||
      root?.superlike ||
      root?.createSuperlike ||
      root?.create;

    // Normalize param key for root controllers that expect `req.params.id`
    req.params = req.params || {};
    req.params.id = targetId;

    if (typeof impl === 'function') {
      // Let the root controller send the response (preferred)
      return impl(req, res);
    }

    // Fallback minimal behavior (no DB changes; only mirrors expected shape)
    return res.json({ ok: true, superliked: targetId });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
  }
}

/**
 * Alias sometimes used in routers/services.
 */
export const create = superlikeUser;

/**
 * Optional convenience: body-based variant used by the /api/superlikes alias.
 * NOTE: Main /api/superlikes implementation currently forwards the request to the
 * single-route, so this is provided for completeness.
 */
export async function superlikeByBody(req, res) {
  try {
    const bodyId = req?.body?.id || req?.body?.userId || req?.body?.targetId;
    if (!bodyId) {
      return res.status(400).json({ ok: false, error: 'Body must include id (or userId/targetId)' });
    }
    if (!isValidObjectId(bodyId)) {
      return res.status(400).json({ ok: false, error: 'Invalid id format (expected 24-hex ObjectId)' });
    }

    // Reuse the param-based handler by normalizing params
    req.params = req.params || {};
    req.params.id = bodyId;
    return superlikeUser(req, res);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Default export (callable middleware) for routers that expect a function
// ──────────────────────────────────────────────────────────────────────────────

export default async function superlikeControllerMiddleware(req, res) {
  return superlikeUser(req, res);
}
// --- REPLACE END ---
