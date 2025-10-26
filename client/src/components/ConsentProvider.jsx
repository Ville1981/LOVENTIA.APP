// PATH: client/src/components/ConsentProvider.jsx

// --- REPLACE START: tiny consent context (localStorage-based) ---
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * IMPORTANT:
 * Keep this storage key in sync with useAds(). It expects the canonical key
 * "loventia:consent" and a JSON object that may include `{ marketing: boolean }`.
 * (It also tolerates `{ ads: boolean }` for legacy CMPs.)
 */
const CONSENT_KEY = "loventia:consent";

const defaultConsent = Object.freeze({
  necessary: true,
  analytics: false,
  marketing: false,
  timestamp: 0,
});

/** Read consent object from localStorage (defensive, tolerant). */
function readStoredConsent() {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return null;
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Normalize to our known shape; accept legacy { ads: boolean } as marketing flag.
    const marketing =
      typeof parsed?.marketing === "boolean"
        ? parsed.marketing
        : typeof parsed?.ads === "boolean"
        ? parsed.ads
        : false;

    return {
      necessary: true,
      analytics: !!parsed?.analytics,
      marketing,
      timestamp: Number(parsed?.timestamp || Date.now()),
    };
  } catch {
    return null;
  }
}

/** Persist consent object to localStorage. */
function writeStoredConsent(value) {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return;
    const payload = {
      // Always persist both keys for compatibility with any legacy readers.
      necessary: true,
      analytics: !!value?.analytics,
      marketing: !!value?.marketing,
      ads: !!value?.marketing,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

const ConsentContext = createContext({
  consent: defaultConsent,
  setConsent: (_next) => {},
  isDecided: false,
});

export const ConsentProvider = ({ children }) => {
  const [consent, setConsentState] = useState(defaultConsent);
  const [isDecided, setIsDecided] = useState(false);

  // Bootstrap from storage
  useEffect(() => {
    const stored = readStoredConsent();
    if (stored) {
      setConsentState(stored);
      setIsDecided(true);
      try {
        const fire = () =>
          window.dispatchEvent(new CustomEvent("consent:ready", { detail: stored }));
        // queueMicrotask can be missing in some test environments
        if (typeof queueMicrotask === "function") queueMicrotask(fire);
        else setTimeout(fire, 0);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Setter exposed to UI (e.g., ConsentBanner)
  const setConsent = useCallback((next) => {
    const normalized = {
      necessary: true,
      analytics: !!next?.analytics,
      marketing: !!next?.marketing,
      timestamp: Date.now(),
    };
    setConsentState(normalized);
    setIsDecided(true);
    writeStoredConsent(normalized);
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("consent:changed", { detail: normalized }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ consent, setConsent, isDecided }),
    [consent, setConsent, isDecided]
  );

  // Optional place for bootstrapping analytics loaders (kept as no-op)
  useEffect(() => {
    if (!isDecided) return;
    // Example (disabled by default):
    // if (consent.analytics) initAnalyticsOnce();
    // else disableAnalytics();
  }, [isDecided, consent.analytics]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
};

export const useConsent = () => useContext(ConsentContext);
// --- REPLACE END ---

