// File: client/src/components/FeatureGate.jsx

// --- REPLACE START: upgraded FeatureGate (supports context user, invert, requirePremium; keeps legacy isPremium passthrough) ---
import React from "react";
import { hasFeature, isPremium as isPremiumFlag } from "../utils/entitlements";
import { useAuth } from "../contexts/AuthContext";

/**
 * FeatureGate
 * Server-driven entitlements gate for UI blocks.
 *
 * Examples:
 *   // Show ads only to non-premium users (invert)
 *   <FeatureGate feature="noAds" invert>
 *     <AdBanner />
 *   </FeatureGate>
 *
 *   // Gate a premium-only module with a fallback CTA
 *   <FeatureGate feature="whoLikedMe" requirePremium fallback={<UpgradeCTA />}>
 *     <WhoLikedMe />
 *   </FeatureGate>
 *
 * Props:
 * - feature: string key in user.entitlements.features (e.g. "noAds", "unlimitedRewinds", "superLikes")
 * - fallback: node rendered when access is denied (optional)
 * - user: explicit user object; if omitted, will use AuthContext's user
 * - allowPremiumBoolean: if true, treats legacy isPremium=true as “all features on” (default true)
 * - invert: if true, renders children when the feature is NOT enabled (useful to show ads to free users)
 * - requirePremium: if true, requires user.isPremium === true in addition to feature allow
 * - onDeny: optional callback fired when gate denies access (diagnostics/analytics)
 *
 * Important: If `feature` is not provided, this gate becomes a pass-through (renders children).
 * This avoids accidental blocking due to misconfiguration.
 */
export default function FeatureGate({
  feature,
  fallback = null,
  user: userProp,
  allowPremiumBoolean = true,
  invert = false,
  requirePremium = false,
  onDeny = null,
  children,
}) {
  // Pull user from AuthContext unless an explicit `user` prop was provided
  const { user: userCtx } = (typeof useAuth === "function" ? useAuth() : {}) || {};
  const user = userProp || userCtx || null;

  // If no specific feature is provided, act as a no-op wrapper (safe default).
  if (feature == null) {
    return <>{children}</>;
  }

  // Premium requirement (if requested)
  const premiumOk = requirePremium ? !!user && !!user?.isPremium : true;

  // Primary entitlement check (server-driven features with legacy boolean passthrough)
  let featureOn = false;
  if (user) {
    try {
      featureOn =
        hasFeature(user, feature) ||
        (allowPremiumBoolean && isPremiumFlag(user));
    } catch {
      // Defensive: if utils throw for any reason, treat as feature off but still allow legacy premium
      featureOn = allowPremiumBoolean && !!user?.isPremium;
    }
  }

  // Final decision with optional inversion.
  const permitted = invert ? !featureOn && premiumOk : featureOn && premiumOk;

  if (!permitted) {
    if (typeof onDeny === "function") {
      try {
        onDeny({
          feature,
          invert,
          requirePremium,
          userId: user?._id || user?.id || null,
          premium: !!user?.isPremium,
        });
      } catch {
        /* noop */
      }
    }
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
// --- REPLACE END ---

