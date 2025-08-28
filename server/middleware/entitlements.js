// File: server/middleware/entitlements.js

// --- REPLACE START: new middleware for feature/plan gating ---
import dotenv from 'dotenv';
dotenv.config();

/**
 * Resolve whether a user has a given feature entitlement.
 * Falls back to legacy flags (isPremium/premium) so older clients still work.
 */
export function userHasFeature(user, featureKey) {
  if (!user) return false;

  // Premium shortcut: premium == all premium features allowed
  const premium =
    user.isPremium === true ||
    user.premium === true ||
    (user.entitlements && user.entitlements.tier === 'premium');

  if (premium) return true;

  // Non-premium: read explicit feature flags if present
  const feat =
    user.entitlements &&
    user.entitlements.features &&
    Object.prototype.hasOwnProperty.call(user.entitlements.features, featureKey)
      ? user.entitlements.features[featureKey]
      : false;

  return !!feat;
}

/**
 * Middleware factory:
 *   requireFeature('seeLikedYou')  → next() if user has feature, otherwise 403.
 * Usage:
 *   router.get('/who-liked-me', ensureAuth, requireFeature('seeLikedYou'), handler)
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
      console.error('[entitlements] gate failed:', err);
      return res.status(500).json({ error: 'Entitlement check failed' });
    }
  };
}

/**
 * Convenience: requirePremium – equivalent to "any premium feature".
 * Useful if a whole endpoint requires premium membership regardless of specific features.
 */
export function requirePremium() {
  return function premiumGate(req, res, next) {
    try {
      const user = req.user || req.authUser || null;

      if (!user && !req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const premium =
        user?.isPremium === true ||
        user?.premium === true ||
        user?.entitlements?.tier === 'premium';

      if (!premium) {
        return res.status(403).json({
          error: 'Premium plan required',
          plan: user?.entitlements?.tier || 'free',
        });
      }

      return next();
    } catch (err) {
      console.error('[entitlements] premium gate failed:', err);
      return res.status(500).json({ error: 'Entitlement check failed' });
    }
  };
}

/**
 * Quota consumer middleware
 * Example: consumeQuota({ path: 'entitlements.quotas.superLikes', limitKey: 'features.superLikesPerWeek' })
 */
export function consumeQuota({ path, limitKey }) {
  if (!path || !limitKey) {
    throw new Error('consumeQuota requires path and limitKey options');
  }

  return async function quotaGate(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const parts = path.split('.');
      let target = user;
      for (const p of parts) {
        if (!target[p]) target[p] = {};
        target = target[p];
      }

      if (typeof target.used !== 'number') target.used = 0;

      const limit = user.entitlements?.[limitKey.split('.')[0]]?.[limitKey.split('.')[1]] ||
                    user.entitlements?.features?.superLikesPerWeek || 0;

      if (target.used >= limit) {
        return res.status(403).json({ error: 'Quota exceeded', quota: limit });
      }

      target.used += 1;

      // Save if user is a mongoose doc
      if (typeof user.save === 'function') {
        try {
          await user.save();
        } catch (e) {
          console.warn('[entitlements] Failed to persist quota usage:', e);
        }
      }

      return next();
    } catch (err) {
      console.error('[entitlements] consumeQuota failed:', err);
      return res.status(500).json({ error: 'Quota check failed' });
    }
  };
}

export default requireFeature;
// --- REPLACE END ---
