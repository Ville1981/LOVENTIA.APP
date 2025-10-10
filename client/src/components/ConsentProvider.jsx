// File: client/src/components/ConsentProvider.jsx

// --- REPLACE START: tiny consent context (localStorage-based) ---
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CONSENT_KEY = "consent.v1";

const defaultConsent = Object.freeze({
  necessary: true,
  analytics: false,
  marketing: false,
  timestamp: 0,
});

function readStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
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
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ ...value, necessary: true, timestamp: Date.now() })
    );
  } catch {
    // ignore
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
      queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent("consent:ready", { detail: stored }));
      });
    }
  }, []);

  const setConsent = useCallback((next) => {
    const normalized = {
      necessary: true,
      analytics: !!next.analytics,
      marketing: !!next.marketing,
      timestamp: Date.now(),
    };
    setConsentState(normalized);
    setIsDecided(true);
    writeStoredConsent(normalized);
    // Let other parts (e.g., analytics loader) react to changes
    window.dispatchEvent(new CustomEvent("consent:changed", { detail: normalized }));
  }, []);

  const value = useMemo(() => ({ consent, setConsent, isDecided }), [consent, setConsent, isDecided]);

  // Optional: wire a super-simple analytics loader (no external deps)
  useEffect(() => {
    if (!isDecided) return;
    if (consent.analytics) {
      // Example hook – replace with your analytics init (GA/Plausible/etc.)
      // window.plausible = window.plausible || function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};
      // Dynamically load your script here if needed.
    } else {
      // If you loaded analytics previously, consider disabling here.
    }
  }, [isDecided, consent.analytics]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
};

export const useConsent = () => useContext(ConsentContext);
// --- REPLACE END ---
