// --- REPLACE START: Full, explicit React-based consent banner (with Provider support) ---
/**
 * ConsentBanner integrates with ConsentProvider (via useConsent) and mirrors
 * decisions to localStorage under "loventia-consent-v1" for legacy/simple pages.
 *
 * Behavior (tested with RTL):
 *  - data-testid="consent-banner" wraps the banner.
 *  - "consent-accept": sets analytics=true, marketing=true, necessary=true and hides.
 *  - "consent-reject": sets analytics=false, marketing=false, necessary=true and hides.
 *  - "consent-manage": opens a <details data-testid="consent-manage-panel">.
 *  - Checkboxes:
 *      - data-testid="consent-chk-analytics"
 *      - data-testid="consent-chk-marketing"
 *  - "consent-manage-save": saves current toggles and hides.
 *  - "consent-manage-reset": resets toggles to {analytics:false, marketing:false}.
 *
 * Notes:
 *  - Guards window.scrollTo in jsdom (our setup overwrites it, but keep defensive try/catch).
 *  - Performs a one-time bootstrap from localStorage into Provider if Provider undecided.
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
import PropTypes from "prop-types";
import { useConsent } from "../ConsentProvider.jsx";

const LS_KEY = "loventia-consent-v1";

/* --------------------------------- Storage --------------------------------- */
function readLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeLS(val) {
  try {
    const payload = { ...val, necessary: true, ts: Date.now() };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      try {
        window.dispatchEvent(new CustomEvent("consent:changed", { detail: payload }));
      } catch {}
    }
  } catch {}
}

/* ------------------------------ Presentational ------------------------------ */
function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      <span>{children}</span>
    </div>
  );
}
Row.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
};

/* --------------------------------- Banner ---------------------------------- */
export default function ConsentBanner() {
  // Align with ConsentProvider API: { consent, setConsent, isDecided }
  const { isDecided, consent, setConsent } = useConsent();
  const [openManage, setOpenManage] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const bootstrappedRef = useRef(false);

  // Bootstrap from LS once if Provider undecided
  useEffect(() => {
    if (isDecided || bootstrappedRef.current) return;
    const fromLS = readLS();
    if (fromLS && typeof setConsent === "function") {
      setConsent({
        analytics: !!fromLS.analytics,
        marketing: !!fromLS.marketing,
        necessary: true,
      });
    }
    bootstrappedRef.current = true;
  }, [isDecided, setConsent]);

  // When Provider decides, mirror to LS and close/hide banner
  useEffect(() => {
    if (!isDecided) return;
    writeLS({
      analytics: !!consent?.analytics,
      marketing: !!consent?.marketing,
      necessary: true,
    });
  }, [isDecided, consent]);

  // Keep local manage-state in sync with Provider when panel opens
  useEffect(() => {
    if (openManage) {
      setAnalytics(!!consent?.analytics);
      setMarketing(!!consent?.marketing);
    }
  }, [openManage, consent]);

  const visible = !isDecided;

  const onAcceptAll = () => {
    // Provider normalizes necessary:true + timestamp internally
    setConsent({ analytics: true, marketing: true, necessary: true });
  };
  const onRejectAll = () => {
    setConsent({ analytics: false, marketing: false, necessary: true });
  };
  const onOpenManage = () => setOpenManage((v) => !v);
  const onResetManage = () => {
    setAnalytics(false);
    setMarketing(false);
  };
  const onSaveManage = () => {
    setConsent({ analytics: !!analytics, marketing: !!marketing, necessary: true });
    try {
      if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
        window.scrollTo(0, 0); // harmless in app; mocked/guarded in tests
      }
    } catch {} // jsdom safety
  };

  const containerStyle = useMemo(
    () =>
      "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl rounded-t-lg border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur",
    []
  );

  if (!visible) return null;

  return (
    <aside className={containerStyle} data-testid="consent-banner" role="dialog" aria-live="polite">
      <h2 className="text-base font-semibold">We use cookies</h2>
      <p className="mt-1 text-sm text-gray-700">
        We use necessary cookies to make our site work. With your consent, we also use analytics and
        marketing cookies to understand usage and improve your experience.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          data-testid="consent-reject"
          onClick={onRejectAll}
          aria-label="Reject non-essential cookies"
        >
          Reject non-essential
        </button>

        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          data-testid="consent-manage"
          onClick={onOpenManage}
          aria-expanded={openManage ? "true" : "false"}
          aria-controls="consent-manage-panel"
        >
          Manage
        </button>

        <button
          type="button"
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white"
          data-testid="consent-accept"
          onClick={onAcceptAll}
          aria-label="Accept all cookies"
        >
          Accept all
        </button>
      </div>

      <details
        id="consent-manage-panel"
        className="mt-3 text-sm"
        data-testid="consent-manage-panel"
        open={openManage}
        onToggle={(e) => setOpenManage(e.currentTarget.open)}
      >
        <summary className="cursor-pointer select-none text-sm font-medium">
          Preferences
        </summary>

        <div className="mt-2 rounded-md border p-3">
          <Row label="Necessary">
            <input type="checkbox" checked readOnly aria-label="Necessary cookies (always on)" />
          </Row>

          <Row label="Analytics">
            <input
              type="checkbox"
              data-testid="consent-chk-analytics"
              checked={!!analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              aria-label="Analytics cookies"
            />
          </Row>

          <Row label="Marketing">
            <input
              type="checkbox"
              data-testid="consent-chk-marketing"
              checked={!!marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              aria-label="Marketing cookies"
            />
          </Row>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1.5"
              data-testid="consent-manage-reset"
              onClick={onResetManage}
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded-md bg-black px-3 py-1.5 text-white"
              data-testid="consent-manage-save"
              onClick={onSaveManage}
            >
              Save choices
            </button>
          </div>
        </div>
      </details>
    </aside>
  );
}
// --- REPLACE END ---

