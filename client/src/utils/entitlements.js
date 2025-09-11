// File: client/src/utils/entitlements.js

// --- REPLACE START: tiny helper for client-side gating ---
/**
 * Client-side entitlement helpers.
 * Mirrors the server-side logic to keep UI gates consistent.
 *
 * Supported feature examples:
 *  - "noAds", "unlimitedRewinds", "dealbreakers", "superLikes",
 *    "whoLikedMe", "unlockQA", "intros"
 *
 * Design goals for tests:
 *  - Do NOT accidentally mark users as "non-premium" in a way that blocks
 *    normal submits without dealbreakers.
 *  - Premium is true only when explicitly indicated by known flags/tier/plan.
 */

/**
 * Normalize feature keys (accept common aliases / casing).
 * Keeps a small alias map so callers can use intuitive names.
 */
function normalizeFeatureKey(key) {
  if (!key) return null;
  const k = String(key).trim();

  // Canonical aliases (lowercased on compare)
  const ALIASES = {
    // who liked me
    "seelikedyou": "whoLikedMe",
    "who-liked-me": "whoLikedMe",
    "who_liked_me": "whoLikedMe",

    // dealbreakers
    "deal-breakers": "dealbreakers",
    "deal_breakers": "dealbreakers",

    // super likes
    "super-like": "superLikes",
    "super_like": "superLikes",
    "superlikes": "superLikes",

    // unlimited rewinds
    "unlimited-rewinds": "unlimitedRewinds",
    "unlimited_rewinds": "unlimitedRewinds",
    "rewind-unlimited": "unlimitedRewinds",

    // QA unlock
    "unlock-qa": "unlockQA",
    "unlock_qa": "unlockQA",

    // ad free
    "no-ads": "noAds",
    "no_ads": "noAds",

    // intro messages
    "intro": "intros",
    "intro-messages": "intros",
    "intro_messages": "intros",
  };

  const lower = k.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ALIASES, lower)) {
    return ALIASES[lower];
  }
  // If not an alias, return the original (preserve canonical camelCase if provided)
  return k;
}

/**
 * Safely read a nested features object.
 */
function getFeaturesObject(user) {
  return user?.entitlements?.features && typeof user.entitlements.features === "object"
    ? user.entitlements.features
    : null;
}

/**
 * Determine if the account is Premium by any of the supported flags.
 * NOTE: We are intentionally conservative here—premium is true only
 * when explicitly indicated. Absence of flags => not premium (but that
 * should NOT block normal non-dealbreaker submits at the component level).
 */
export function isPremium(user) {
  return !!(
    user &&
    (
      user.isPremium === true ||
      user.premium === true ||
      user?.entitlements?.tier === "premium" ||
      user?.entitlements?.plan === "premium" ||
      user?.entitlements?.plans?.includes?.("premium")
    )
  );
}

/**
 * Return true if the user should have access to the given feature on the client.
 * Accepts friendly aliases (e.g., "seeLikedYou" -> "whoLikedMe").
 * Premium implies all features are enabled.
 */
export function hasFeature(user, featureKey) {
  if (!user) return false;

  // Premium users get all features
  if (isPremium(user)) return true;

  const normalized = normalizeFeatureKey(featureKey);
  if (!normalized) return false;

  const feats = getFeaturesObject(user);
  if (!feats) return false;

  // Direct lookup on canonical key
  if (Object.prototype.hasOwnProperty.call(feats, normalized)) {
    return !!feats[normalized];
  }

  // Also check a lowercase variant to be tolerant to server casing
  const lower = normalized.toLowerCase();
  for (const [k, v] of Object.entries(feats)) {
    if (k.toLowerCase() === lower) return !!v;
  }

  return false;
}

export default { isPremium, hasFeature };
// --- REPLACE END ---
