// PATH: client/src/components/InterstitialAd.jsx

// --- REPLACE START: gate interstitial with AdGate (Premium/no-ads kill-switch) + debug info + why-am-I-seeing-this ---
import React, { useEffect, useRef } from "react";
import AdGate from "./AdGate"; // centralized gate: hides interstitial for Premium / noAds
import useAds from "../hooks/useAds";
import { useAuth } from "../contexts/AuthContext";

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
 * Accessibility:
 * - Uses role="dialog" + aria-modal="true"
 * - Exposes aria-labelledby="interstitial-title" and aria-describedby="interstitial-description"
 *   so screen readers get a clear title and description.
 * - Focus moves into the dialog on mount and is restored on unmount.
 * - Tab/Shift+Tab are trapped inside the dialog content.
 *
 * Debug:
 * - When window.__ADS_DEBUG === true OR localStorage["ads:debug"] === "1" (dev only),
 *   a small debug row is rendered at the bottom of the modal showing cap/counters.
 *
 * UX:
 * - For non-premium users (noAdsGlobal === false), a small info line explains:
 *   “You are seeing this ad because you are using Loventia for free...”
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

  const ads = useAds();
  const { user } = useAuth() ?? {};

  const userIsPremium = !!(user?.isPremium || user?.premium);
  const userNoAdsFeature = !!user?.entitlements?.features?.noAds;
  const noAdsGlobal = userIsPremium || userNoAdsFeature;

  const capPerDay =
    typeof ads?.capPerDay === "number" && Number.isFinite(ads.capPerDay)
      ? ads.capPerDay
      : null;

  // Try to read some kind of interstitial count from ads; fallback to null if not present.
  let usedToday = null;
  if (ads?.countsToday && typeof ads.countsToday.interstitial === "number") {
    usedToday = ads.countsToday.interstitial;
  } else if (ads?.flags && typeof ads.flags.interstitialShownToday === "number") {
    usedToday = ads.flags.interstitialShownToday;
  }

  // Debug flag: dev-only, opt-in via window.__ADS_DEBUG or localStorage["ads:debug"] === "1"
  let debugEnabled = false;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    try {
      if (window.__ADS_DEBUG === true) {
        debugEnabled = true;
      } else if (window.localStorage?.getItem("ads:debug") === "1") {
        debugEnabled = true;
      }
    } catch {
      // ignore storage access errors in dev
    }
  }

  // Whether to show the "Why am I seeing this ad?" info line
  const showWhyInfo = !noAdsGlobal;

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
    // AdGate type="interstitial" ensures Premium/no-ads users never see this modal
    <AdGate type="interstitial" debug={debugEnabled}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby="interstitial-title"
        aria-describedby="interstitial-description"
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
            <div id="interstitial-title" className="text-base font-semibold">
              Sponsored interstitial
            </div>
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
            {/* Short description for screen readers and users */}
            <p
              id="interstitial-description"
              className="mb-2 text-xs text-gray-600"
            >
              This is a full-screen sponsored message shown before you continue using Loventia.
            </p>

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

            {/* Why-am-I-seeing-this info (FREE users only) */}
            {showWhyInfo && (
              <p className="mt-3 text-xs text-gray-600">
                You are seeing this ad because you are using Loventia for free. Premium members do
                not see ads.
              </p>
            )}

            {/* Debug row (visible only when debugEnabled is true) */}
            {debugEnabled && (
              <div className="mt-3 border-t pt-2 text-xs text-gray-500 flex flex-col gap-1">
                <div>
                  Ad debug: interstitial{" "}
                  {usedToday !== null && usedToday !== undefined ? usedToday : "n/a"}
                  {capPerDay !== null && capPerDay !== undefined
                    ? ` / ${capPerDay} today`
                    : ""}
                </div>
                <div>
                  capPerDay:{" "}
                  {capPerDay !== null && capPerDay !== undefined ? capPerDay : "n/a"} | noAdsGlobal:{" "}
                  {noAdsGlobal ? "true" : "false"} | adsIsPremium:{" "}
                  {ads?.isPremium ? "true" : "false"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdGate>
  );
}
// --- REPLACE END ---

