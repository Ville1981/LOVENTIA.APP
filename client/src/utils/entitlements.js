// client/src/utils/entitlements.js
// --- REPLACE START: tiny helper for client-side gating ---
/**
 * Return true if the user should have access to the given feature on the client.
 * Mirrors server-side logic to avoid UX drift.
 */
export function hasFeature(user, featureKey) {
  if (!user) return false;

  const premium =
    user.isPremium === true ||
    user.premium === true ||
    (user.entitlements && user.entitlements.tier === 'premium');

  if (premium) return true;

  const feat =
    user.entitlements &&
    user.entitlements.features &&
    Object.prototype.hasOwnProperty.call(user.entitlements.features, featureKey)
      ? user.entitlements.features[featureKey]
      : false;

  return !!feat;
}

/**
 * Simple premium helper for UI conditions.
 */
export function isPremium(user) {
  return !!(
    user &&
    (user.isPremium === true ||
      user.premium === true ||
      user?.entitlements?.tier === 'premium')
  );
}
// --- REPLACE END ---
