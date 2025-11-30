// File: client/src/hooks/useAds.js

// --- REPLACE START: add readiness + dev diagnostics + dev override (keep structure intact) ---
import { useMemo, useEffect } from "react";
import useEntitlements from "./useEntitlements";
import { createLogger } from "../utils/debugLog";

const log = createLogger("useAds");

/** Helpers **/
const bool = (v) => String(v).toLowerCase() === "true";
const todayKey = () => new Date().toISOString().slice(0, 10);
const CAP_LS_KEY = (d = todayKey()) => `ads:cap:${d}`;

/**
 * Read marketing consent from storage.
 * Priority:
 *  1) "loventia:consent" (our canonical key) → { marketing: boolean } | { ads: boolean }
 *  2) fallbacks: "cookie-consent", "cookieConsent", "consent"
 *  3) window.__CONSENT__ (dev/testing)
 */
function readMarketingConsent() {
  // Canonical first
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("loventia:consent") : null;
    if (raw) {
      const obj = JSON.parse(raw);
      if (typeof obj?.marketing === "boolean") return obj.marketing;
      if (typeof obj?.ads === "boolean") return obj.ads;
    }
  } catch {
    /* ignore parse errors */
  }

  // Fallback keys (legacy/third-party CMPs)
  const keys = ["cookie-consent", "cookieConsent", "consent"];
  for (const k of keys) {
    try {
      const raw =
        typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (typeof obj?.marketing === "boolean") return obj.marketing;
      if (typeof obj?.ads === "boolean") return obj.ads;
    } catch {
      /* ignore */
    }
  }

  // Dev/testing escape hatch
  if (typeof window !== "undefined" && window.__CONSENT__) {
    const v = window.__CONSENT__.marketing ?? window.__CONSENT__.ads;
    if (typeof v === "boolean") return v;
  }
  return false;
}

// Frequency-cap helpers
function getCounts(day = todayKey()) {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(CAP_LS_KEY(day))
        : null;
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
function setCounts(obj, day = todayKey()) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CAP_LS_KEY(day), JSON.stringify(obj || {}));
    }
  } catch {
    /* quota ignore */
  }
}
function getCount(type, day = todayKey()) {
  const c = getCounts(day);
  return Number(c?.[type] || 0);
}
function note(type, day = todayKey()) {
  const c = getCounts(day);
  c[type] = Number(c?.[type] || 0) + 1;
  setCounts(c, day);
}

/**
 * useAds
 * Centralized decision: enabled by flags, requires consent, denies for premium,
 * enforces daily frequency caps per placement type.
 *
 * Adds:
 *  - ready: boolean (entitlements resolved)
 *  - dev diagnostics/override: window.__ADS_STATE__ / window.__adsDebug (dev only)
 */
export default function useAds() {
  // Flags from Vite env (memoize once)
  const flags = useMemo(() => {
    return {
      enabled: bool(import.meta.env.VITE_ADS_ENABLED ?? "false"),
      interstitial: bool(import.meta.env.VITE_ADS_INTERSTITIAL_ENABLED ?? "false"),
      overlay: bool(import.meta.env.VITE_ADS_OVERLAY_ENABLED ?? "false"),
      inline: bool(import.meta.env.VITE_ADS_INLINE_ENABLED ?? "false"),
      cap: parseInt(import.meta.env.VITE_ADS_FREQ_CAP_PER_DAY ?? "0", 10) || 0,
    };
  }, []);

  // Dev override knobs (no effect in production builds)
  const devOverride =
    !!import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.localStorage.getItem("ads:forceInterstitial") === "1";

  const devForceCount =
    !!import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.localStorage.getItem("ads:forceCount") === "1";

  // Entitlements (source of truth for isPremium)
  // Note: we assume the hook exposes a loading flag; default false for safety.
  const { isPremium, loading: entitlementsLoading = false } = useEntitlements({
    enabled: true,
  });
  const ready = !entitlementsLoading;

  // Consent
  const hasConsent = readMarketingConsent();

  // Base allow (do NOT gate on "ready" here to preserve prior behavior;
  // the caller can use `ready` if it wants to wait before deciding)
  const baseAllow = flags.enabled && hasConsent && !isPremium;

  // Under-cap predicate
  const underCap = (type) => (flags.cap > 0 ? getCount(type) < flags.cap : true);

  // Final per-slot decision
  // Interstitial respects developer override in development: if devOverride === true, allow regardless of gates.
  const canShow = {
    interstitial:
      devOverride || (baseAllow && flags.interstitial && underCap("interstitial")),
    overlay: baseAllow && flags.overlay && underCap("overlay"),
    inline: baseAllow && flags.inline && underCap("inline"),
  };

  // Record impression unless we are in devOverride mode for interstitial and counting is not explicitly forced.
  const noteImpression = (type) => {
    if (devOverride && type === "interstitial" && !devForceCount) {
      if (import.meta.env.DEV && typeof window !== "undefined" && window.__ADS_DEBUG) {
        log("[useAds] devOverride active → NOT incrementing interstitial cap");
      }
      return;
    }
    note(type);
  };

  // Dev-time diagnostics (safe no-ops in prod)
  useEffect(() => {
    if (!import.meta.env?.DEV) return;
    if (typeof window === "undefined") return;

    try {
      // Expose snapshot for quick inspection
      const snapshot = {
        flags,
        isPremium,
        ready,
        hasConsent,
        capPerDay: flags.cap,
        canShow,
        countsToday: getCounts(), // useful when debugging cap
        debug: { devOverride, devForceCount },
      };
      window.__ADS_STATE__ = snapshot;
      // Alias for convenience (camelCase commonly typed in console)
      window.__adsDebug = snapshot;

      if (window.__ADS_DEBUG) {
        log("[useAds]", snapshot);
        if (devOverride) {
          log(
            "[useAds] DEV OVERRIDE: interstitial will open regardless of gate conditions"
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, [
    flags,
    isPremium,
    ready,
    hasConsent,
    canShow.interstitial,
    canShow.overlay,
    canShow.inline,
    devOverride,
    devForceCount,
  ]);

  return {
    // diagnostics
    flags,
    isPremium,
    ready,
    hasConsent,
    capPerDay: flags.cap,
    // decisions
    canShow,
    // side-effect
    noteImpression,
  };
}
// --- REPLACE END ---


