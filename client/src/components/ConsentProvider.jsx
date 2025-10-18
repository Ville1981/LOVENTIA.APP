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
 * Keep this storage key in sync with ConsentBanner.jsx.
 * Banner mirrors/reads the same key to ensure one source of truth.
 */
const CONSENT_KEY = "loventia-consent-v1";

const defaultConsent = Object.freeze({
  necessary: true,
  analytics: false,
  marketing: false,
  timestamp: 0,
});

function readStoredConsent() {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return null;
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Guard: keep only known keys
    return {
      necessary: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
      timestamp: Number(parsed.timestamp || Date.now()),
    };
  } catch {
    return null;
  }
}

function writeStoredConsent(value) {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return;
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ ...value, necessary: true, timestamp: Date.now() })
    );
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

  useEffect(() => {
    const stored = readStoredConsent();
    if (stored) {
      setConsentState(stored);
      setIsDecided(true);
      try {
        const fire = () =>
          window.dispatchEvent(new CustomEvent("consent:ready", { detail: stored }));
        // queueMicrotask is not available in all test envs
        if (typeof queueMicrotask === "function") queueMicrotask(fire);
        else setTimeout(fire, 0);
      } catch {
        /* ignore event errors in non-DOM envs */
      }
    }
  }, []);

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

  // Optional hook for analytics/marketing loaders; intentionally no-op in tests
  useEffect(() => {
    if (!isDecided) return;
    // if (consent.analytics) { initAnalyticsOnce(); } else { disableAnalytics(); }
  }, [isDecided, consent.analytics]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
};

export const useConsent = () => useContext(ConsentContext);
// --- REPLACE END ---
