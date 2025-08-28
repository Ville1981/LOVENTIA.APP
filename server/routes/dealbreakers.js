// File: server/routes/dealbreakers.js
// --- REPLACE START: ESM Dealbreakers routes (premium-gated; robust userId resolution) ---
'use strict';

import express from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Lightweight inline entitlement check.
 * If user.isPremium is true, we consider all premium features granted.
 * Otherwise check entitlements.features.dealbreakers.
 */
function hasDealbreakers(user) {
  try {
    if (!user) return false;
    if (user.isPremium || user.premium) return true;
    return !!(user.entitlements && user.entitlements.features && user.entitlements.features.dealbreakers);
  } catch {
    return false;
  }
}

/**
 * Resolve current user's id from different shapes used by auth middlewares.
 * Accepts: req.user._id, req.user.id, req.user.userId, req.userId.
 */
function getCurrentUserId(req) {
  return (
    req?.user?._id ||
    req?.user?.id ||
    req?.user?.userId ||
    req?.userId ||
    null
  );
}

/**
 * GET /api/dealbreakers
 * Returns the current user's dealbreaker filters.
 * Skeleton persists data inside User document under `preferences.dealbreakers`.
 * If not found, returns sensible defaults.
 */
router.get('/dealbreakers', authenticate, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await User.findById(userId).lean().exec();
    if (!me) return res.status(404).json({ error: 'User not found' });

    // Default structure; keep simple first
    const defaults = {
      distanceKm: null,              // null means "off"
      ageMin: null,                  // null means "off"
      ageMax: null,
      mustHavePhoto: false,
      nonSmokerOnly: false,
      noDrugs: false,
      petsOk: null,                  // null/true/false
      religion: [],                  // keep open-ended
      education: [],                 // keep open-ended
    };

    const current = me.preferences?.dealbreakers || defaults;
    return res.json({ dealbreakers: { ...defaults, ...current } });
  } catch (err) {
    console.error('[dealbreakers] GET error', err);
    return res.status(500).json({ error: 'Failed to load dealbreakers' });
  }
});

/**
 * PATCH /api/dealbreakers
 * Updates the current user's dealbreaker filters (Premium-gated).
 * Body accepts partial updates. Values set to null will clear fields.
 */
router.patch('/dealbreakers', authenticate, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await User.findById(userId).exec();
    if (!me) return res.status(404).json({ error: 'User not found' });

    if (!hasDealbreakers(me)) {
      return res.status(403).json({ error: 'Dealbreakers are available to Premium users only.' });
    }

    const payload = req.body || {};
    // Ensure nested path exists
    if (!me.preferences || typeof me.preferences !== 'object') me.preferences = {};
    if (!me.preferences.dealbreakers || typeof me.preferences.dealbreakers !== 'object') {
      me.preferences.dealbreakers = {};
    }

    // Whitelist fields we accept (avoid accidental writes)
    const allowed = [
      'distanceKm',
      'ageMin',
      'ageMax',
      'mustHavePhoto',
      'nonSmokerOnly',
      'noDrugs',
      'petsOk',
      'religion',
      'education',
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        me.preferences.dealbreakers[key] = payload[key];
      }
    }

    await me.save();
    return res.json({ success: true, dealbreakers: me.preferences.dealbreakers });
  } catch (err) {
    console.error('[dealbreakers] PATCH error', err);
    return res.status(500).json({ error: 'Failed to update dealbreakers' });
  }
});

/**
 * POST /api/discover/search
 * Skeleton endpoint showing how dealbreakers might be applied server-side.
 * In production, you would merge "soft" filters with these "hard" dealbreakers.
 * Here we only echo the payload with a note whether dealbreakers are active.
 */
router.post('/discover/search', authenticate, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await User.findById(userId).lean().exec();
    if (!me) return res.status(404).json({ error: 'User not found' });

    const active = hasDealbreakers(me);
    const db = me.preferences?.dealbreakers || null;

    // In a real implementation, use db values to build a Mongo query.
    // This skeleton only returns a stubbed list + flags.
    const stubbedResults = [
      { id: 'u1', username: 'Alice', age: 29, distanceKm: 4, smoker: false },
      { id: 'u2', username: 'Bob', age: 35, distanceKm: 7, smoker: false },
    ];

    return res.json({
      appliedDealbreakers: active ? db : null,
      premiumRequired: true,
      results: stubbedResults,
    });
  } catch (err) {
    console.error('[dealbreakers] /discover/search error', err);
    return res.status(500).json({ error: 'Failed to run discovery search' });
  }
});

export default router;
// --- REPLACE END ---

