// File: server/routes/rewind.js
// --- REPLACE START: ESM version of rewind route (Premium-only: unlimitedRewinds) ---
'use strict';

import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
// --- REPLACE START: remove global authenticate to avoid blocking /api/auth/* ---
// import authenticate from '../middleware/auth.js';
// --- REPLACE END ---

const router = express.Router();

// --- NEW: parse JSON bodies for this router so PATCH/POST can read req.body ---
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// --- REPLACE START: do NOT apply authenticate globally on this router ---
// router.use(authenticate);
// Applying it here would intercept /api/auth/login and /api/auth/refresh and cause "Access token required".
// Auth is enforced per-endpoint (inline) by resolving the current user below.
// --- REPLACE END ---

/**
 * In this file we keep a minimal inline auth guard:
 * - prefers `req.user` (populated by upstream auth when present)
 * - also supports a DEV fallback header `Authorization: Bearer <rawUserId>` for local tools
 */

// ---------- Helpers ----------

/** Resolve current user id from typical shapes. */
function getCurrentUserId(req) {
  return (
    req?.user?._id ||
    req?.user?.id ||
    req?.user?.userId ||
    req?.userId ||
    null
  );
}

/** Resolve the current user doc from request. */
async function resolveCurrentUser(req) {
  // Prefer req.user if your auth middleware set it
  const idFromUser = getCurrentUserId(req);
  if (idFromUser) {
    // If it's already a mongoose doc, return as-is
    if (req.user && typeof req.user.save === 'function') return req.user;
    return User.findById(idFromUser).exec();
  }

  // Fallback for local testing: allow a raw userId in Authorization: Bearer <id>
  try {
    const auth = String(req.headers.authorization || '');
    const parts = auth.split(' ');
    if (parts[0] === 'Bearer' && mongoose.isValidObjectId(parts[1])) {
      return User.findById(parts[1]).exec();
    }
  } catch {
    /* noop */
  }
  return null;
}

/** Check if the user has Premium rewind entitlement. */
function canRewind(user) {
  if (!user) return false;
  const feat = user.entitlements && user.entitlements.features;
  // Legacy flag OR explicit feature gate
  return !!(user.isPremium || user.premium || (feat && feat.unlimitedRewinds));
}

/** Choose which array to pop from (likes or passes). */
function chooseScope(user, requestedScope) {
  const scope = (requestedScope || '').toLowerCase();
  if (scope === 'likes' || scope === 'passes') return scope;

  // No explicit scope: prefer undoing the most common "like" action first
  if (Array.isArray(user.likes) && user.likes.length > 0) return 'likes';
  if (Array.isArray(user.passes) && user.passes.length > 0) return 'passes';
  return null;
}

// ---------- Route ----------

/**
 * POST /rewind
 * Body (optional):
 *   - scope: 'likes' | 'passes'  (if omitted, tries likes -> passes)
 *
 * Behavior:
 *   - Premium-only (feature: unlimitedRewinds or legacy isPremium)
 *   - Pops one id from the chosen array and saves the user
 *   - Returns { ok: true, rewound: 'likes'|'passes', targetUserId }
 */
router.post('/rewind', async (req, res) => {
  try {
    const current = await resolveCurrentUser(req);
    if (!current) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (!canRewind(current)) {
      return res.status(403).json({
        ok: false,
        error: 'Premium required: unlimitedRewinds',
        code: 'FEATURE_LOCKED',
        feature: 'unlimitedRewinds',
      });
    }

    const scope = chooseScope(current, req.body && req.body.scope);
    if (!scope) {
      return res.status(400).json({
        ok: false,
        error: 'Nothing to rewind',
        detail: 'Neither likes nor passes contain any items.',
      });
    }

    if (!Array.isArray(current[scope]) || current[scope].length === 0) {
      return res.status(400).json({
        ok: false,
        error: `No entries in ${scope} to rewind`,
      });
    }

    // Remove last target from the chosen list
    const targetUserId = current[scope].pop();

    // Persist changes
    await current.save();

    return res.json({
      ok: true,
      rewound: scope,
      targetUserId: String(targetUserId),
      message: scope === 'likes'
        ? 'Last like has been undone.'
        : 'Last pass has been undone.',
    });
  } catch (err) {
    console.error('[rewind] error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
    });
  }
});

export default router;
// --- REPLACE END ---
