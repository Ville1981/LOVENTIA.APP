// File: server/routes/dealbreakers.js
// --- REPLACE START: ESM Dealbreakers routes (premium-gated; robust userId resolution; strict-safe writes) ---
'use strict';

import express from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Lightweight inline entitlement check.
 * If user.isPremium is true (or legacy premium), we consider all premium features granted.
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
 * Parse helpers (defensive: accept strings/booleans/numbers).
 */
function asNumOrNull(v, { min = -Infinity, max = Infinity } = {}) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(min, Math.min(max, n));
  return clamped;
}
function asBoolOrNull(v) {
  if (v === '' || v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return null;
}
function asBool(v, fallback = false) {
  const n = asBoolOrNull(v);
  return n === null ? fallback : n;
}
function asStringArray(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (v === '' || v == null) return [];
  // Accept CSV string
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Return sane API defaults for the dealbreakers object.
 * NOTE: Keep in sync with client DiscoverFilters dealbreakers fields.
 */
function defaultDealbreakers() {
  return {
    distanceKm: null,      // null = off
    ageMin: null,          // null = off
    ageMax: null,
    mustHavePhoto: false,
    nonSmokerOnly: false,
    noDrugs: false,
    petsOk: null,          // null/true/false
    religion: [],          // array of strings
    education: [],         // array of strings
  };
}

/**
 * GET /api/dealbreakers
 * Returns the current user's dealbreaker filters.
 * We persist under `preferences.dealbreakers` in the User document.
 * IMPORTANT: Our User schema may be strict; Mongoose still returns unknown paths present in MongoDB.
 */
router.get('/dealbreakers', authenticate, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await User.findById(userId).lean().exec();
    if (!me) return res.status(404).json({ error: 'User not found' });

    const defaults = defaultDealbreakers();
    const current = (me.preferences && me.preferences.dealbreakers) ? me.preferences.dealbreakers : {};
    return res.json({ dealbreakers: { ...defaults, ...current } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dealbreakers] GET error', err);
    return res.status(500).json({ error: 'Failed to load dealbreakers' });
  }
});

/**
 * PATCH /api/dealbreakers
 * Updates the current user's dealbreaker filters (Premium-gated).
 * Body accepts partial updates. Values set to null/"" will clear fields where applicable.
 *
 * ⚠️ IMPORTANT: Because the User schema may be `strict: true` and might not declare `preferences.dealbreakers`,
 * we write with an update operation using `{ strict: false }` to allow the nested path.
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

    // Whitelist & sanitize
    const updateDoc = {};
    const setPath = (key, value) => {
      updateDoc[`preferences.dealbreakers.${key}`] = value;
    };

    if ('distanceKm' in payload) {
      setPath('distanceKm', asNumOrNull(payload.distanceKm, { min: 1, max: 1000 }));
    }
    if ('ageMin' in payload) {
      setPath('ageMin', asNumOrNull(payload.ageMin, { min: 18, max: 120 }));
    }
    if ('ageMax' in payload) {
      setPath('ageMax', asNumOrNull(payload.ageMax, { min: 18, max: 120 }));
    }
    if ('mustHavePhoto' in payload) {
      setPath('mustHavePhoto', asBool(payload.mustHavePhoto, false));
    }
    if ('nonSmokerOnly' in payload) {
      setPath('nonSmokerOnly', asBool(payload.nonSmokerOnly, false));
    }
    if ('noDrugs' in payload) {
      setPath('noDrugs', asBool(payload.noDrugs, false));
    }
    if ('petsOk' in payload) {
      // Accept boolean, "true"/"false", "", null → null clears
      const b = asBoolOrNull(payload.petsOk);
      setPath('petsOk', b);
    }
    if ('religion' in payload) {
      setPath('religion', asStringArray(payload.religion));
    }
    if ('education' in payload) {
      setPath('education', asStringArray(payload.education));
    }

    // If nothing to update, just echo current state
    if (Object.keys(updateDoc).length === 0) {
      const doc = await User.findById(userId).lean().exec();
      const defaults = defaultDealbreakers();
      const current = doc?.preferences?.dealbreakers || {};
      return res.json({ success: true, dealbreakers: { ...defaults, ...current } });
    }

    // Write with strict:false so nested undeclared paths are allowed
    await User.updateOne(
      { _id: userId },
      { $set: updateDoc },
      { strict: false }
    ).exec();

    // Return merged result after write
    const after = await User.findById(userId).lean().exec();
    const defaults = defaultDealbreakers();
    const current = after?.preferences?.dealbreakers || {};
    return res.json({ success: true, dealbreakers: { ...defaults, ...current } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dealbreakers] PATCH error', err);
    return res.status(500).json({ error: 'Failed to update dealbreakers' });
  }
});

/**
 * POST /api/discover/search
 * Skeleton endpoint showing how dealbreakers might be applied server-side.
 * In production, you would merge "soft" filters with these "hard" dealbreakers.
 * Here we only return a stubbed list + flags.
 */
router.post('/discover/search', authenticate, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await User.findById(userId).lean().exec();
    if (!me) return res.status(404).json({ error: 'User not found' });

    const premiumActive = hasDealbreakers(me);
    const db = me.preferences?.dealbreakers || null;

    // Stub data (unchanged)
    const stubbedResults = [
      { id: 'u1', username: 'Alice', age: 29, distanceKm: 4, smoker: false },
      { id: 'u2', username: 'Bob', age: 35, distanceKm: 7, smoker: false },
    ];

    // Echo back applied dealbreakers (only when premiumActive)
    const defaults = defaultDealbreakers();
    const applied = premiumActive && db ? { ...defaults, ...db } : null;

    return res.json({
      appliedDealbreakers: applied,
      premiumRequired: true,
      results: stubbedResults,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dealbreakers] /discover/search error', err);
    return res.status(500).json({ error: 'Failed to run discovery search' });
  }
});

export default router;
// --- REPLACE END ---
