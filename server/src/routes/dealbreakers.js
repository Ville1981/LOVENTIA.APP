// File: server/src/routes/dealbreakers.js
// --- REPLACE START: ESM Dealbreakers routes (root-mounted; robust userId resolution; strict-safe writes) ---
'use strict';

import express from 'express';
import authenticate from '../middleware/authenticate.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Lightweight entitlement check.
 * If user.isPremium or entitlements.tier === "premium" is true (or legacy premium),
 * consider dealbreakers (and other premium filters) granted.
 * Otherwise check entitlements.features.dealbreakers and a few related premium flags.
 */
function hasDealbreakers(user) {
  try {
    if (!user) return false;

    // Hard premium flags on the user document
    if (user.isPremium === true || user.premium === true) {
      return true;
    }

    const ent = user.entitlements || {};
    const feat = ent.features || {};

    // Entitlements-tier based premium
    if (ent.tier === 'premium') {
      return true;
    }

    // Explicit dealbreakers feature flag
    if (feat.dealbreakers === true) {
      return true;
    }

    // Fallback: if any of these strong premium features are granted, we also allow dealbreakers
    if (feat.unlimitedLikes === true || feat.unlimitedRewinds === true || feat.noAds === true) {
      return true;
    }

    return false;
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
 * GET / (mounted at /api/dealbreakers)
 * Returns the current user's dealbreaker filters.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await User.findById(userId).lean().exec();
    if (!me) return res.status(404).json({ error: 'User not found' });

    const defaults = defaultDealbreakers();
    const current = (me.preferences && me.preferences.dealbreakers) ? me.preferences.dealbreakers : {};
    return res.json({ dealbreakers: { ...defaults, ...current } });
  } catch (err) {
    console.error('[dealbreakers] GET error', err);
    return res.status(500).json({ error: 'Failed to load dealbreakers' });
  }
});

/**
 * PATCH / (mounted at /api/dealbreakers)
 * Updates the current user's dealbreaker filters (Premium-gated).
 */
router.patch('/', authenticate, async (req, res) => {
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

    await User.updateOne(
      { _id: userId },
      { $set: updateDoc },
      { strict: false }
    ).exec();

    const after = await User.findById(userId).lean().exec();
    const defaults = defaultDealbreakers();
    const current = after?.preferences?.dealbreakers || {};
    return res.json({ success: true, dealbreakers: { ...defaults, ...current } });
  } catch (err) {
    console.error('[dealbreakers] PATCH error', err);
    return res.status(500).json({ error: 'Failed to update dealbreakers' });
  }
});

/**
 * POST /discover/search (mounted at /api/dealbreakers/discover/search)
 * Skeleton endpoint showing how dealbreakers might be applied server-side.
 */
router.post('/discover/search', authenticate, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await User.findById(userId).lean().exec();
    if (!me) return res.status(404).json({ error: 'User not found' });

    const premiumActive = hasDealbreakers(me);
    const db = me.preferences?.dealbreakers || null;

    const stubbedResults = [
      { id: 'u1', username: 'Alice', age: 29, distanceKm: 4, smoker: false },
      { id: 'u2', username: 'Bob', age: 35, distanceKm: 7, smoker: false },
    ];

    const defaults = defaultDealbreakers();
    const applied = premiumActive && db ? { ...defaults, ...db } : null;

    return res.json({
      appliedDealbreakers: applied,
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


