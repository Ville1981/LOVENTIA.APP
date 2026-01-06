// PATH: client/src/components/privacy/ConsentBanner.jsx
// File: client/src/components/privacy/ConsentBanner.jsx

// --- REPLACE START: Full, explicit React-based consent banner (with Provider support + a11y) ---
/**
 * ConsentBanner integrates with ConsentProvider (via useConsent) and mirrors
 * decisions to localStorage under the canonical key "loventia:consent".
 *
 * Behavior:
 *  - data-testid="consent-banner" wraps the banner.
 *  - "consent-accept": sets analytics=true, marketing=true (necessary always true) and hides.
 *  - "consent-reject": sets analytics=false, marketing=false (necessary true) and hides.
 *  - "consent-manage": toggles <details data-testid="consent-manage-panel">.
 *  - Checkboxes:
 *      - data-testid="consent-chk-analytics"
 *      - data-testid="consent-chk-marketing"
 *  - "consent-manage-save": saves current toggles and hides.
 *  - "consent-manage-reset": resets toggles to {analytics:false, marketing:false}.
 *
 * Accessibility:
 *  - Rendered as a bottom-anchored dialog (`role="dialog"`, `aria-modal="true"`).
 *  - `h2` with id used as accessible name via aria-labelledby.
 *  - Description paragraph referenced via aria-describedby.
 *  - When banner first appears, focus is moved to the primary action button.
 *  - Escape closes the manage panel (but not the entire banner).
 *
 * Notes:
 *  - Guards window.scrollTo for test environments.
 *  - Performs a one-time bootstrap from localStorage into Provider if undecided.
 *  - CLS: the banner is fixed-position (overlay) and uses CSS containment to reduce
 *    expensive relayout/repaint work. It should not push page content.
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
import PropTypes from "prop-types";
import { useConsent } from "../ConsentProvider.jsx";

const LS_KEY = "loventia:consent";

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
    const payload = {
      necessary: true,
      analytics: !!val?.analytics,
      marketing: !!val?.marketing,
      // also write legacy-compatible "ads" mirror for readers expecting it
      ads: !!val?.marketing,
      timestamp: Date.now(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      try {
        window.dispatchEvent(new CustomEvent("consent:changed", { detail: payload }));
      } catch {
        /* noop */
      }
    }
  } catch {
    /* storage errors ignored */
  }
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

  // Refs for a11y
  const bannerRef = useRef(null);
  const primaryButtonRef = useRef(null);

  // Bootstrap from LS once if Provider undecided
  useEffect(() => {
    if (isDecided || bootstrappedRef.current) return;
    const fromLS = readLS();
    if (fromLS && typeof setConsent === "function") {
      setConsent({
        analytics: !!fromLS.analytics,
        marketing: typeof fromLS.marketing === "boolean" ? fromLS.marketing : !!fromLS.ads,
        necessary: true,
      });
    }
    bootstrappedRef.current = true;
  }, [isDecided, setConsent]);

  // When Provider decides, mirror to LS (keeps legacy/simple pages in sync)
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

  // When banner becomes visible, move focus to primary action (Accept all)
  useEffect(() => {
    if (!visible) return;
    try {
      if (primaryButtonRef.current && typeof primaryButtonRef.current.focus === "function") {
        primaryButtonRef.current.focus();
      } else if (bannerRef.current && typeof bannerRef.current.focus === "function") {
        bannerRef.current.focus();
      }
    } catch {
      /* ignore focus errors in tests or legacy browsers */
    }
  }, [visible]);

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
        window.scrollTo(0, 0);
      }
    } catch {
      /* jsdom safety */
    }
  };

  // Handle Escape: close manage panel (if open) but keep the banner itself
  const handleKeyDown = (event) => {
    if (event.key === "Escape" || event.key === "Esc") {
      if (openManage) {
        event.preventDefault();
        event.stopPropagation();
        setOpenManage(false);
      }
    }
  };

  const containerClassName = useMemo(
    () =>
      "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl rounded-t-lg border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur",
    []
  );

  // --- REPLACE START: CLS/perf containment (overlay should not force page relayout) ---
  const containerInlineStyle = useMemo(
    () => ({
      // Contain layout/paint work to the banner itself; reduce expensive invalidations.
      contain: "layout paint",
      // Promote to its own layer (helps reduce repaint artifacts on some mobile browsers).
      willChange: "transform",
      transform: "translateZ(0)",
      // Respect iOS safe-area so the banner doesn't "jump" when the browser chrome changes.
      paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
      // Keep the banner from growing too tall on small screens (overlay only; no page push).
      maxHeight: "60vh",
      overflowY: "auto",
    }),
    []
  );
  // --- REPLACE END ---

  if (!visible) return null;

  return (
    <aside
      ref={bannerRef}
      className={containerClassName}
      style={containerInlineStyle}
      data-testid="consent-banner"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-labelledby="consent-banner-title"
      aria-describedby="consent-banner-description"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <h2 id="consent-banner-title" className="text-base font-semibold">
        We use cookies
      </h2>
      <p id="consent-banner-description" className="mt-1 text-sm text-gray-700">
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
          ref={primaryButtonRef}
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
            <input
              type="checkbox"
              checked
              readOnly
              aria-label="Necessary cookies (always on)"
            />
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


