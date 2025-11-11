// File: client/src/components/AdGate.jsx

// --- REPLACE START: unify Premium/No-Ads kill-switch via AuthContext, preserve existing impression logic & dev debug ---
import React, { useEffect, useRef } from "react";
import useAds from "../hooks/useAds";
import { createLogger } from "../utils/debugLog";
import { useAuth } from "../contexts/AuthContext"; // single source for isPremium & entitlements
const log = createLogger("AdGate");

/**
 * AdGate
 * Wrap any ad component. Renders children only when ads are allowed.
 *
 * Props:
 *  - type: "inline" | "overlay" | "interstitial"  (default: "inline")
 *  - onImpression?: () => void  (optional callback when we record an impression)
 *  - debug?: boolean             (prints gating info to console if true)
 *
 * Notes:
 *  - Records ONE impression per mount when the slot is actually visible on screen.
 *  - For "interstitial", we skip IntersectionObserver (it's inherently visible) and
 *    record once when allowed flips to true.
 *  - DEV override support:
 *      * if (import.meta.env.DEV && localStorage['ads:forceInterstitial']==='1'):
 *          - we log that overlay/interstitial are being forced allowed (for visibility parity in logs),
 *          - but we DO NOT increment real impressions unless localStorage['ads:forceCount']==='1'.
 *      * This affects ONLY logging + impression counting, NOT actual gating/visibility.
 *
 * Premium/No-Ads (global kill-switch):
 *  - If AuthContext reports user.isPremium === true OR entitlements.features.noAds === true,
 *    we do NOT render ads (return null) and we DO NOT count impressions.
 */
export default function AdGate({ type = "inline", onImpression, debug = false, children }) {
  const ads = useAds();

  // Read Premium / No-Ads from the single source of truth (AuthContext)
  const { user } = useAuth() ?? {};
  const userIsPremium = !!(user?.isPremium || user?.premium);
  const userNoAdsFeature = !!user?.entitlements?.features?.noAds;
  const noAdsGlobal = userIsPremium || userNoAdsFeature; // ← global kill-switch

  // Base allow from current ads rules (consent, caps, etc.)
  const allowedByAdsRules =
    type === "interstitial"
      ? ads.canShow.interstitial
      : type === "overlay"
      ? ads.canShow.overlay
      : ads.canShow.inline;

  // Final allow = ads rules AND NOT (global no-ads)
  const allowed = allowedByAdsRules && !noAdsGlobal;

  // DEV-only override flags (used for logging and impression suppression)
  const devOverride =
    !!import.meta.env.DEV &&
    typeof window !== "undefined" &&
    localStorage.getItem("ads:forceInterstitial") === "1";
  const devForceCount =
    !!import.meta.env.DEV &&
    typeof window !== "undefined" &&
    localStorage.getItem("ads:forceCount") === "1";

  // Avoid multiple impressions on re-renders
  const notedOnceRef = useRef(false);

  // Wrapper to observe visibility (not used for interstitial)
  const slotRef = useRef(null);

  // Debug: log gating info whenever it changes
  useEffect(() => {
    if (!debug) return;

    // Compose a consistent debug payload
    const payload = {
      type,
      allowed,
      allowedByAdsRules,
      // useAds snapshot
      flags: ads.flags,
      hasConsent: ads.hasConsent,
      adsIsPremium: ads.isPremium,
      capPerDay: ads.capPerDay,
      // AuthContext snapshot (source of truth for No-Ads)
      userIsPremium,
      userNoAdsFeature,
      noAdsGlobal,
      notedOnce: notedOnceRef.current,
      dev: { devOverride, devForceCount },
    };

    // eslint-disable-next-line no-console
    console.info("[AdGate]", payload);

    if (noAdsGlobal) {
      // eslint-disable-next-line no-console
      console.info("[AdGate] Global no-ads is active (Premium or feature). Ad content will not render.");
    } else if (devOverride && (type === "overlay" || type === "interstitial")) {
      // eslint-disable-next-line no-console
      console.info(
        "[AdGate] DEV override active -> treating as allowed in logs (rendering still respects useAds).",
        { type, noteCounting: devForceCount ? "ENABLED (devForceCount=1)" : "DISABLED (no cap impact)" }
      );
    }
  }, [
    debug,
    type,
    allowed,
    allowedByAdsRules,
    ads.flags,
    ads.hasConsent,
    ads.isPremium,
    ads.capPerDay,
    userIsPremium,
    userNoAdsFeature,
    noAdsGlobal,
    devOverride,
    devForceCount,
  ]);

  // Impression logic:
  // - Interstitial: note once immediately when allowed becomes true
  // - Overlay/Inline: wait until element is intersecting the viewport
  useEffect(() => {
    if (!allowed) return;

    // If already noted for this mount, do nothing
    if (notedOnceRef.current) return;

    // Helper: guarded impression (respects dev override suppression)
    const noteImpressionGuarded = () => {
      // In DEV override, avoid affecting real caps unless explicitly forced
      const suppressForDev =
        devOverride && !devForceCount && (type === "interstitial" || type === "overlay");

      if (suppressForDev) {
        notedOnceRef.current = true;
        if (typeof onImpression === "function") onImpression();
        if (debug) {
          // eslint-disable-next-line no-console
          console.info("[AdGate] DEV override -> impression NOT counted (cap unaffected)", { type });
        }
        return;
      }

      // Normal path: count the impression
      notedOnceRef.current = true;
      ads.noteImpression(type);
      if (typeof onImpression === "function") onImpression();
      if (debug) {
        // eslint-disable-next-line no-console
        console.info(
          "[AdGate] impression noted",
          type === "interstitial" ? "(interstitial)" : "(visible)"
        );
      }
    };

    if (type === "interstitial") {
      // Interstitials are inherently visible when allowed/opened
      noteImpressionGuarded();
      return;
    }

    // For inline/overlay placements, use IntersectionObserver to ensure visibility
    let observer;
    const el = slotRef.current;

    const noteNow = () => {
      if (notedOnceRef.current) return;
      noteImpressionGuarded();
    };

    // If no DOM (SSR safety) or element missing, fallback to immediate note
    if (typeof window === "undefined" || !("IntersectionObserver" in window) || !el) {
      noteNow();
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            noteNow();
            if (observer) observer.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: "0px", threshold: 0.1 }
    );

    observer.observe(el);

    return () => {
      if (observer) observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, type, onImpression, debug, devOverride, devForceCount]);

  // Short-circuit: global no-ads or disallowed by ads rules
  if (!allowed) return null;

  // Interstitial returns children directly (no wrapper)
  if (type === "interstitial") {
    return children ?? null;
  }

  // Overlay/Inline: wrap with a minimal div so we can observe visibility
  return (
    <div ref={slotRef} data-ad-slot={type}>
      {children ?? null}
    </div>
  );
}
// --- REPLACE END ---

