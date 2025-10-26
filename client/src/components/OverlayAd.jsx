// --- REPLACE START: accessible, lightweight overlay ad (UI only; gating done by AdGate) ---
import React, { useEffect, useRef } from "react";
import { trackAdClick } from "../utils/analytics";

/**
 * OverlayAd
 * Small dismissible corner banner. Business rules (consent, premium, caps) are
 * handled by AdGate/useAds; this component focuses on accessible UI.
 *
 * Props:
 *  - onClose: () => void
 *  - position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" (default: "bottom-right")
 *  - imgSrc?: string
 *  - imgAlt?: string
 *  - ariaLabel?: string
 *  - ctaHref?: string
 *  - ctaText?: string
 */
export default function OverlayAd({
  onClose,
  position = "bottom-right",
  imgSrc = "/ads/overlay1.png",
  imgAlt = "Advertisement",
  ariaLabel = "Advertisement",
  ctaHref = "#",
  ctaText = "Learn more",
}) {
  const closeBtnRef = useRef(null);

  useEffect(() => {
    // move focus to close button for keyboard users
    closeBtnRef.current?.focus?.();
  }, []);

  const posClass =
    position === "bottom-left"
      ? "left-4 bottom-4"
      : position === "top-right"
      ? "right-4 top-4"
      : position === "top-left"
      ? "left-4 top-4"
      : "right-4 bottom-4";

  return (
    <aside
      role="complementary"
      aria-label={ariaLabel}
      className={`fixed ${posClass} z-40`}
    >
      <div className="relative w-[min(92vw,320px)] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        {/* Close */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close advertisement"
          className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white focus:outline-none focus:ring focus:ring-blue-300"
        >
          ✕
        </button>

        {/* Creative */}
        <img src={imgSrc} alt={imgAlt} className="block h-auto w-full" />

        {/* CTA */}
        <div className="flex items-center justify-between gap-2 p-3">
          <a
            href={ctaHref}
            onClick={() => trackAdClick("overlay", { href: ctaHref })}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-300"
          >
            {ctaText}
          </a>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="text-xs text-gray-500 underline hover:text-gray-700 focus:outline-none focus:ring focus:ring-blue-300"
            aria-label="Hide advertisement"
          >
            Hide
          </button>
        </div>
      </div>
    </aside>
  );
}
// --- REPLACE END ---
