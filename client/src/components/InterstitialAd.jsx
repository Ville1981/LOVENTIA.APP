// PATH: client/src/components/InterstitialAd.jsx

// --- REPLACE START: interstitial modal that ALLOWS background scroll (no body lock), ESC/backdrop/close, focus trap ---
import React, { useEffect, useRef } from "react";

/**
 * InterstitialAd
 * NOTE: This component DOES NOT create its own portal.
 * A parent (e.g. RouteInterstitial) should mount this into a portal container like #route-interstitial-root.
 *
 * Features:
 * - Close on:
 *    • primary "Continue" (from children) if it calls onClose
 *    • explicit top-right Close (X)
 *    • secondary "Skip ad" button
 *    • ESC key
 *    • backdrop click
 * - Focus trap inside the dialog
 * - IMPORTANT: Background (page) IS ALLOWED to scroll while this modal is open (no body lock).
 *
 * All user-visible strings are in English.
 */
export default function InterstitialAd({
  onClose,
  ariaLabel = "Advertisement",
  children,
  className = "",
}) {
  const containerRef = useRef(null);
  const prevFocusRef = useRef(null);

  // Focus management: focus panel on mount, restore previous focus on unmount
  useEffect(() => {
    prevFocusRef.current = document.activeElement;

    const node = containerRef.current;
    if (node) {
      const focusables = node.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusables[0] || node).focus?.({ preventScroll: true });
    }

    return () => {
      if (prevFocusRef.current && typeof prevFocusRef.current.focus === "function") {
        prevFocusRef.current.focus();
      }
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Basic focus trap (Tab/Shift+Tab stays inside)
  const handleKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const node = containerRef.current;
    if (!node) return;

    const focusables = node.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const list = Array.from(focusables).filter(
      (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1
    );
    if (!list.length) return;

    const first = list[0];
    const last = list[list.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Backdrop click closes; clicks inside dialog do not bubble out
  const onBackdropClick = () => onClose?.();
  const stop = (e) => e.stopPropagation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-testid="interstitial-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ pointerEvents: "auto" }}
      onClick={onBackdropClick}
      onKeyDown={handleKeyDown}
      // DO NOT lock body scroll here; we intentionally allow background to scroll
    >
      {/* Backdrop — opaque for visuals, but background can still scroll since body is not locked */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={containerRef}
        tabIndex={-1}
        className={
          "relative z-[10000] w-[min(96vw,820px)] max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl outline-none " +
          className
        }
        onClick={stop}
      >
        {/* Header with Close (X) */}
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <div className="text-base font-semibold">Sponsored interstitial</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 focus:outline-none focus:ring focus:ring-blue-300"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        {/* Ad content from parent (e.g., image + primary Continue) */}
        <div className="p-4">
          {children}

          {/* Secondary action row (explicit close path always available) */}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 focus:outline-none focus:ring focus:ring-blue-300"
            >
              Skip ad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// --- REPLACE END ---

