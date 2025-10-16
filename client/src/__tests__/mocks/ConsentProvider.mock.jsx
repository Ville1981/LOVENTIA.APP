import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

export const CONSENT_KEY = "consent.v1";

const ConsentContext = createContext({
  consent: { necessary: true, analytics: false, marketing: false },
  setConsent: (_next) => {},
  isDecided: false,
});

function writeStoredConsent(value) {
  try {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ ...value, necessary: true, timestamp: Date.now() })
    );
  } catch {}
}

export const ConsentProvider = ({ children }) => {
  const [consent, setConsentState] = useState({ necessary: true, analytics: false, marketing: false });
  const [isDecided, setIsDecided] = useState(false);

  const setConsent = useCallback((next) => {
    const normalized = { necessary: true, analytics: !!next.analytics, marketing: !!next.marketing };
    setConsentState(normalized);
    setIsDecided(true);
    writeStoredConsent(normalized);
    window.dispatchEvent(new CustomEvent("consent:changed", { detail: normalized }));
  }, []);

  const value = useMemo(() => ({ consent, setConsent, isDecided }), [consent, setConsent, isDecided]);
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
};

export const useConsent = () => useContext(ConsentContext);
export { ConsentContext };
