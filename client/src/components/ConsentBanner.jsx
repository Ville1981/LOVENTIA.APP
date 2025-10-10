// File: client/src/components/ConsentBanner.jsx

// --- REPLACE START: accessible cookie/consent banner (fixed bottom) ---
import React, { useMemo, useState } from "react";

import { useConsent } from "./ConsentProvider";

const Banner = ({ onManage }) => {
  const { setConsent } = useConsent();
  const [analytics, setAnalytics] = useState(true);   // default ON in the manage panel
  const [marketing, setMarketing] = useState(false);  // default OFF

  const acceptAll = () => setConsent({ analytics: true, marketing: true });
  const rejectNonEssential = () => setConsent({ analytics: false, marketing: false });

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-5xl rounded-t-lg border border-gray-200 bg-white/95 shadow-xl backdrop-blur p-4"
      data-testid="consent-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-800">
          We use cookies to make this site work and to improve your experience.{" "}
          <a href="/privacy" className="underline">Privacy</a> ·{" "}
          <a href="/cookies" className="underline">Cookie Policy</a>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={rejectNonEssential}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            data-testid="consent-reject"
          >
            Reject non-essential
          </button>
          <button
            type="button"
            onClick={onManage}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            data-testid="consent-manage"
          >
            Manage
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            data-testid="consent-accept"
          >
            Accept all
          </button>
        </div>
      </div>

      {/* Manage panel (progressive disclosure) */}
      <details className="mt-3 text-sm" data-testid="consent-manage-panel">
        <summary className="cursor-pointer select-none text-gray-700">Detailed settings</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked disabled />
            <span>
              <strong>Necessary</strong> – required for core functionality.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              data-testid="consent-chk-analytics"
            />
            <span>
              <strong>Analytics</strong> – help us understand usage (anonymous).
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              data-testid="consent-chk-marketing"
            />
            <span>
              <strong>Marketing</strong> – personalization and offers.
            </span>
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => {
                setAnalytics(false);
                setMarketing(false);
              }}
              data-testid="consent-manage-reset"
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black"
              onClick={() => {
                // Save granular choice
                // eslint-disable-next-line no-undef
                window?.scrollTo?.({ top: 0, behavior: "smooth" });
                setConsent({ analytics, marketing });
              }}
              data-testid="consent-manage-save"
            >
              Save choices
            </button>
          </div>
        </div>
      </details>
    </div>
  );
};

const ConsentBanner = () => {
  const { isDecided } = useConsent();
  const [showManage, setShowManage] = useState(false);
  const onManage = () => setShowManage((s) => !s);

  // Do not render when already decided
  const hidden = useMemo(() => !!isDecided, [isDecided]);
  if (hidden) return null;

  return <Banner onManage={onManage} />;
};

export default ConsentBanner;
// --- REPLACE END ---
