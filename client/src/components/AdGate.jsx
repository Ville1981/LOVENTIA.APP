// File: client/src/components/AdGate.jsx

// --- REPLACE START: unify Premium/No-Ads kill-switch via AuthContext, preserve existing impression logic & dev debug ---
import React, { useEffect, useRef } from "react";
import useAds from "../hooks/useAds";
import { useAuth } from "../contexts/AuthContext"; // single source for isPremium & entitlements

/**
 * Small visual debug bar that can be rendered under any ad slot.
 * Shows impressions vs cap, premium/no-ads flags and basic state.
 */
function AdDebugBar({ type, allowed, allowedByAdsRules, ads, noAdsGlobal }) {
  const capPerDay = ads?.capPerDay ?? "n/a";

  // Try multiple possible counters, fall back to "n/a"
  const rawCount =
    ads?.impressionsToday ??
    ads?.countToday ??
    ads?.stats?.impressionsToday ??
    ads?.stats?.today ??
    null;

  const countToday = typeof rawCount === "number" ? rawCount : "n/a";

  const premiumLabel = noAdsGlobal ? "NO-ADS (Premium/feature)" : "Ads enabled";
  const flagsLabel = ads?.flags?.debug ? "flags.debug=1" : "flags.debug=0";

  return (
    <div
      className="mt-1 px-2 py-1 text-[10px] leading-tight text-gray-500 bg-gray-50 border-t border-gray-200 rounded-b-2xl"
      data-ad-debug="1"
    >
      <span className="font-semibold">Ad debug:</span>{" "}
      <span className="mr-1">{type}</span>
      <span className="mr-1">
        {countToday}/{capPerDay} today
      </span>
      <span className="mr-1">{premiumLabel}</span>
      <span className="mr-1">{flagsLabel}</span>
      <span className="mr-1">allowed={String(allowed)}</span>
      <span>rules={String(allowedByAdsRules)}</span>
    </div>
  );
}

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
 *
 * Visual debug:
 *  - When uiDebug is true, a small AdDebugBar is rendered under the ad content.
 *    uiDebug is true if:
 *      * debug prop is true, OR
 *      * ads.flags.debug is true, OR
 *      * (DEV && window.__ADS_DEBUG === true)
 */
export default function AdGate({ type = "inline", onImpression, debug = false, children }) {
  const ads = useAds();

  // Read Premium / No-Ads from the single source of truth (AuthContext)
  const { user } = useAuth() ?? {};
  const userIsPremium = !!(user?.isPremium || user?.premium);
  const userNoAdsFeature = !!user?.entitlements?.features?.noAds;
  const noAdsGlobal = userIsPremium || userNoAdsFeature; // ← global kill-switch

  // Base allow from current ads rules (consent, caps, etc.) – guard against undefined
  const canShowInline = ads?.canShow?.inline ?? false;
  const canShowOverlay = ads?.canShow?.overlay ?? false;
  const canShowInterstitial = ads?.canShow?.interstitial ?? false;

  const allowedByAdsRules =
    type === "interstitial"
      ? canShowInterstitial
      : type === "overlay"
      ? canShowOverlay
      : canShowInline;

  // Final allow = ads rules AND NOT (global no-ads)
  const allowed = allowedByAdsRules && !noAdsGlobal;

  // DEV-only override flags (used for logging and impression suppression)
  const devOverride =
    !!import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.localStorage?.getItem("ads:forceInterstitial") === "1";
  const devForceCount =
    !!import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.localStorage?.getItem("ads:forceCount") === "1";

  // UI debug flag (for visible debug bar)
  const uiDebug =
    debug ||
    !!ads?.flags?.debug ||
    (!!import.meta.env.DEV &&
      typeof window !== "undefined" &&
      window.__ADS_DEBUG === true);

  // Avoid multiple impressions on re-renders
  const notedOnceRef = useRef(false);

  // Wrapper to observe visibility (not used for interstitial)
  const slotRef = useRef(null);

  // Debug: log gating info whenever it changes
  useEffect(() => {
    if (!uiDebug) return;

    const payload = {
      type,
      allowed,
      allowedByAdsRules,
      // useAds snapshot
      flags: ads?.flags,
      hasConsent: ads?.hasConsent,
      adsIsPremium: ads?.isPremium,
      capPerDay: ads?.capPerDay,
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
      console.info(
        "[AdGate] Global no-ads is active (Premium or feature). Ad content will not render."
      );
    } else if (devOverride && (type === "overlay" || type === "interstitial")) {
      // eslint-disable-next-line no-console
      console.info(
        "[AdGate] DEV override active -> treating as allowed in logs (rendering still respects useAds).",
        {
          type,
          noteCounting: devForceCount
            ? "ENABLED (devForceCount=1)"
            : "DISABLED (no cap impact)",
        }
      );
    }
  }, [
    uiDebug,
    type,
    allowed,
    allowedByAdsRules,
    ads?.flags,
    ads?.hasConsent,
    ads?.isPremium,
    ads?.capPerDay,
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
        if (uiDebug) {
          // eslint-disable-next-line no-console
          console.info("[AdGate] DEV override -> impression NOT counted (cap unaffected)", {
            type,
          });
        }
        return;
      }

      // Normal path: count the impression
      notedOnceRef.current = true;
      ads?.noteImpression?.(type);
      if (typeof onImpression === "function") onImpression();
      if (uiDebug) {
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
  }, [allowed, type, onImpression, uiDebug, devOverride, devForceCount]);

  // Short-circuit: global no-ads or disallowed by ads rules
  if (!allowed) return null;

  // Interstitial returns children directly (no wrapper)
  if (type === "interstitial") {
    if (!children) {
      return uiDebug ? (
        <AdDebugBar
          type={type}
          allowed={allowed}
          allowedByAdsRules={allowedByAdsRules}
          ads={ads}
          noAdsGlobal={noAdsGlobal}
        />
      ) : null;
    }

    return (
      <>
        {children}
        {uiDebug && (
          <AdDebugBar
            type={type}
            allowed={allowed}
            allowedByAdsRules={allowedByAdsRules}
            ads={ads}
            noAdsGlobal={noAdsGlobal}
          />
        )}
      </>
    );
  }

  // Overlay/Inline: wrap with a minimal div so we can observe visibility
  return (
    <div ref={slotRef} data-ad-slot={type}>
      {children ?? null}
      {uiDebug && (
        <AdDebugBar
          type={type}
          allowed={allowed}
          allowedByAdsRules={allowedByAdsRules}
          ads={ads}
          noAdsGlobal={noAdsGlobal}
        />
      )}
    </div>
  );
}
// --- REPLACE END ---
