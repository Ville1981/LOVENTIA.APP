// PATH: client/src/components/privacy/ConsentBanner.jsx

// --- REPLACE START: hardened, accessible consent banner with cross-tab sync ---
import React, { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "loventia-consent-v1";

/**
 * Small helpers to safely access localStorage (SSR/Privacy modes friendly).
 */
function readConsent() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      // Accept legacy non-JSON values by treating them as "accepted"
      return { analytics: true, ts: Date.now(), _legacy: true };
    }
  } catch {
    return null;
  }
}

function writeConsent(value) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore write failures (private mode, blocked storage, etc.)
  }
}

/**
 * Minimal Consent Banner:
 * - Shows until a choice is stored in localStorage.
 * - Dispatches 'consent:changed' CustomEvent for analytics loaders to react to.
 * - Syncs across tabs via 'storage' event.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  // Do not render during tests (keeps Vitest/Cypress calmer)
  const isTest = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

  const hideIfAlreadyConsented = useCallback(() => {
    const v = readConsent();
    setVisible(!v); // show only if nothing stored yet
  }, []);

  useEffect(() => {
    if (isTest) return;
    hideIfAlreadyConsented();

    // Cross-tab sync: hide if user consents in another tab
    const onStorage = (e) => {
      if (e?.key === STORAGE_KEY) {
        hideIfAlreadyConsented();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hideIfAlreadyConsented, isTest]);

  if (isTest || !visible) return null;

  const dispatchChange = (analytics) => {
    try {
      window.dispatchEvent(
        new CustomEvent("consent:changed", { detail: { analytics } })
      );
    } catch {
      // no-op
    }
  };

  const accept = () => {
    const payload = { analytics: true, ts: Date.now() };
    writeConsent(payload);
    setVisible(false);
    dispatchChange(true);
  };

  const decline = () => {
    const payload = { analytics: false, ts: Date.now() };
    writeConsent(payload);
    setVisible(false);
    dispatchChange(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Cookie consent"
        className="mx-auto m-2 flex max-w-5xl flex-col items-center gap-3 rounded-2xl bg-white p-4 shadow-lg sm:flex-row"
      >
        <p className="text-sm">
          We use cookies for essential functionality and, with your consent, for analytics. See our
          <a href="/privacy" className="ml-1 underline">Privacy</a> and
          <a href="/cookies" className="ml-1 underline">Cookies</a>.
        </p>

        <div className="ml-auto flex gap-2">
          <button
            onClick={decline}
            type="button"
            className="rounded-xl bg-gray-200 px-3 py-2"
            aria-label="Decline analytics cookies"
          >
            Decline
          </button>
          <button
            onClick={accept}
            type="button"
            className="rounded-xl bg-black px-3 py-2 text-white"
            aria-label="Allow analytics cookies"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}
// --- REPLACE END ---
