// File: server/src/middleware/entitlements.js

// --- REPLACE START: entitlement gates + NUMERIC quota middleware (weekly-safe) ---
'use strict';

import dotenv from 'dotenv';
dotenv.config();

/**
 * This middleware module provides:
 *  - userHasFeature(user, key)        → boolean
 *  - requireFeature(key)              → Express middleware
 *  - requirePremium()                 → Express middleware
 *  - consumeQuota(opts)               → Express middleware that ENFORCES & INCREMENTS usage
 *
 * Changes in this replacement:
 *  - Quota reading is STRICTLY NUMERIC from entitlements.features.superLikesPerWeek (or from a given limitKey).
 *  - Weekly window is enforced via ISO week keys; usage resets automatically on new week.
 *  - Persists usage on Mongoose user docs (no-op safe if plain object).
 *  - Backwards compatibility:
 *      * premium/isPremium/entitlements.tier === 'premium' → treated as premium.
 *      * legacy boolean features.superLikesPerWeek === true → interpreted as env SUPERLIKES_PER_WEEK || 3.
 */

const PREMIUM_NUM_FALLBACK = Number(process.env.SUPERLIKES_PER_WEEK || 3);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Safe premium detection */
export function isPremiumUser(user) {
  return (
    user?.isPremium === true ||
    user?.premium === true ||
    user?.entitlements?.tier === 'premium'
  );
}

/** Feature check (premium implies all) */
export function userHasFeature(user, featureKey) {
  if (!user) return false;
  if (isPremiumUser(user)) return true;
  return Boolean(user?.entitlements?.features && user.entitlements.features[featureKey] === true);
}

/** Shallow path getter: "a.b.c" → value (undefined if missing) */
function getPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Shallow path setter: creates buckets as needed */
function setPath(obj, path, value) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Coerce any input to a non-negative integer (default 0) */
function toNonNegInt(v, def = 0) {
  const n = Number(v);
  if (!Number.isFinite(n) || Number.isNaN(n)) return def;
  const i = Math.floor(n);
  return i < 0 ? 0 : i;
}

/** YYYY-Www (ISO week), e.g. "2025-W45" */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thu
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  const wk = String(week).padStart(2, '0');
  return `${date.getUTCFullYear()}-W${wk}`;
}

/** Start-of-next ISO week (UTC Monday 00:00) */
function nextIsoWeekStart(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // 0..6 (Mon..Sun)
  const daysToNextMon = (7 - dayNum) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysToNextMon);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** Read NUMERIC weekly limit from entitlements.features.superLikesPerWeek (or legacy boolean) */
function readNumericSuperLikesLimit(user) {
  const raw = user?.entitlements?.features?.superLikesPerWeek;
  if (typeof raw === 'number' && Number.isFinite(raw)) return toNonNegInt(raw, 0);
  if (raw === true) return toNonNegInt(PREMIUM_NUM_FALLBACK, 3); // legacy boolean → premium fallback
  if (isPremiumUser(user)) return toNonNegInt(PREMIUM_NUM_FALLBACK, 3);
  return 0;
}

/** Generic numeric feature reader supporting custom keys like "features.someLimit" */
function readNumericLimitByKey(user, limitKey) {
  if (!limitKey) return 0;
  const raw = getPath(user?.entitlements || {}, limitKey);
  if (typeof raw === 'number') return toNonNegInt(raw, 0);
  if (raw === true) return toNonNegInt(PREMIUM_NUM_FALLBACK, 3);
  return 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Gates
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Middleware factory:
 *   requireFeature('seeLikedYou')  → next() if user has feature, otherwise 403.
 */
export function requireFeature(featureKey) {
  if (typeof featureKey !== 'string' || !featureKey) {
    throw new Error('requireFeature(featureKey) expects a non-empty string');
  }

  return function featureGate(req, res, next) {
    try {
      const user = req.user || req.authUser || null;
      if (!user && !req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const ok = userHasFeature(user, featureKey);
      if (!ok) {
        return res.status(403).json({
          error: 'Feature not available for your plan',
          missingFeature: featureKey,
          plan: user?.entitlements?.tier || (user?.isPremium ? 'premium' : 'free'),
        });
      }

      return next();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[entitlements] gate failed:', err);
      return res.status(500).json({ error: 'Entitlement check failed' });
    }
  };
}

/**
 * Convenience: requirePremium – equivalent to "any premium feature".
 */
export function requirePremium() {
  return function premiumGate(req, res, next) {
    try {
      const user = req.user || req.authUser || null;

      if (!user && !req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const premium = isPremiumUser(user);
      if (!premium) {
        return res.status(403).json({
          error: 'Premium plan required',
          plan: user?.entitlements?.tier || 'free',
        });
      }

      return next();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[entitlements] premium gate failed:', err);
      return res.status(500).json({ error: 'Entitlement check failed' });
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────────
/**
 * Quota consumer middleware
 *
 * Example usage for Super Likes (weekly):
 *   router.post(
 *     '/superlike/:id',
 *     authenticate,
 *     consumeQuota({
 *       path: 'entitlements.quotas.superLikes',             // where {used, weekKey} live
 *       limitKey: 'features.superLikesPerWeek',             // read numeric limit from entitlements.features
 *       window: 'weekly',                                   // auto-reset by ISO week
 *       legacyBooleanPremium: true                          // treat boolean true as env fallback
 *     }),
 *     controller.superlikeUser
 *   )
 *
 * Options:
 *   - path: string               required; bucket to maintain usage (will create object if missing)
 *   - limitKey: string           optional; relative to entitlements.* (e.g. "features.superLikesPerWeek")
 *                                If omitted or not numeric, falls back to premium boolean → env(3) or 0.
 *   - window: 'weekly' | null    currently supports 'weekly' (ISO week). Null disables auto-reset.
 *   - legacyBooleanPremium: bool if true, boolean feature flags map to numeric fallback for premium.
 */
export function consumeQuota({
  path,
  limitKey = 'features.superLikesPerWeek',
  window = 'weekly',
  legacyBooleanPremium = true,
} = {}) {
  if (!path) {
    throw new Error('consumeQuota requires a `path` option (e.g., "entitlements.quotas.superLikes")');
  }

  return async function quotaGate(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Ensure bucket object exists
      const bucket = getPath(user, path) || {};
      setPath(user, path, bucket);

      // Auto-reset by window (weekly via ISO)
      if (window === 'weekly') {
        const wk = isoWeekKey();
        if (bucket.weekKey !== wk) {
          bucket.weekKey = wk;
          bucket.used = 0;
        }
      }

      // Current usage (coerced)
      bucket.used = toNonNegInt(bucket.used, 0);

      // Determine NUMERIC limit
      let limit = 0;
      if (limitKey) {
        // read from entitlements.limitKey (relative)
        limit = readNumericLimitByKey(user, `entitlements.${limitKey}`);
      }
      if (!limit && legacyBooleanPremium) {
        // fallback if boolean or premium without numeric was set
        limit = readNumericSuperLikesLimit(user);
      }

      // Enforce quota; 0 means no entitlement
      if (!limit || bucket.used >= limit) {
        return res.status(403).json({
          ok: false,
          code: 'LIMIT_REACHED',
          error: 'Quota limit reached.',
          remaining: 0,
          limit,
          resetAt: window === 'weekly' ? nextIsoWeekStart().toISOString() : null,
        });
      }

      // Consume one unit
      bucket.used += 1;

      // Persist if Mongoose document
      if (typeof user.save === 'function') {
        try {
          await user.save();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[entitlements] Failed to persist quota usage:', e?.message || e);
        }
      }

      // Provide helpful headers (optional; safe if ignored)
      const remaining = Math.max(0, limit - bucket.used);
      res.setHeader?.('X-Quota-Limit', String(limit));
      res.setHeader?.('X-Quota-Used', String(bucket.used));
      res.setHeader?.('X-Quota-Remaining', String(remaining));
      if (window === 'weekly') {
        res.setHeader?.('X-Quota-Reset-At', nextIsoWeekStart().toISOString());
      }

      return next();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[entitlements] consumeQuota failed:', err);
      return res.status(500).json({ error: 'Quota check failed' });
    }
  };
}

export default requireFeature;
// --- REPLACE END ---

