// --- REPLACE START: Inline ad slot (remove broken adsData import, keep 1200×300 header, safe fallbacks) ---
import React, { useMemo } from "react";
import AdGate from "./AdGate";
import { trackAdClick } from "../utils/analytics";

/**
 * InlineAdSlot
 * - placement === "header": render a fixed 1200×300 header creative (object-cover) with graceful fallback.
 * - placement === "inline": original inline card (unchanged behavior).
 *
 * Props:
 *  - placement?: "inline" | "header" (default: "inline")
 *  - children?: ReactNode                     (custom creative for inline)
 *  - ariaLabel?: string                       (SR label for inline)
 *  - imgSrc?: string                          (default creative for inline)
 *  - imgAlt?: string
 *  - ctaHref?: string
 *  - ctaText?: string
 *  - className?: string                       (wrapper class for both)
 *  - headerAlt?: string                       (SR label for header image)
 */
export default function InlineAdSlot({
  placement = "inline",
  children,
  ariaLabel = "Sponsored content",
  imgSrc = "/ads/inline1.png",
  imgAlt = "Advertisement",
  ctaHref = "#",
  ctaText = "Learn more",
  className = "",
  headerAlt = "Header advertisement",
}) {
  /**
   * Header source selection:
   * 1) Explicit env -> VITE_HEADER_AD_SRC (or VITE_INTERSTITIAL_AD_SRC).
   * 2) Built-in list -> /ads/header{1,2,3}.png (matches your existing files).
   * 3) Final fallback -> /ads/sample-banner.jpg (keeps layout visible).
   *
   * This removes the hard dependency on ../api/adsData.js which failed to resolve in Vite.
   * If you later want to re-use adsData.js, replace HEADER_LIST below with your import.
   */
  const headerSrc = useMemo(() => {
    const envVal =
      import.meta?.env?.VITE_HEADER_AD_SRC ||
      import.meta?.env?.VITE_INTERSTITIAL_AD_SRC ||
      null;

    // Matches your existing files:
    const HEADER_LIST = ["/ads/header1.png", "/ads/header2.png", "/ads/header3.png"];

    return envVal || HEADER_LIST[0] || "/ads/sample-banner.jpg";
  }, []);

  // ---------------- HEADER PLACEMENT ----------------
  if (placement === "header") {
    return (
      <AdGate type="inline">
        <aside
          role="complementary"
          aria-label={headerAlt}
          className={`w-full flex justify-center ${className}`}
        >
          <div
            className="relative w-full max-w-[1200px] h-[300px] overflow-hidden rounded-2xl shadow-md border border-gray-200 bg-white"
            data-testid="header-ad-slot"
          >
            {headerSrc ? (
              <img
                src={headerSrc}
                alt={headerAlt}
                className="absolute inset-0 h-full w-full object-cover select-none"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  // Keep the reserved area even if the image fails.
                  e.currentTarget.style.display = "none";
                  const holder = e.currentTarget.nextElementSibling;
                  if (holder) holder.removeAttribute("hidden");
                }}
              />
            ) : null}

            {/* Fallback placeholder (visible only if image fails/missing) */}
            <div
              hidden={Boolean(headerSrc)}
              className="absolute inset-0 flex items-center justify-center bg-blue-600 text-white text-2xl font-semibold tracking-wide"
              aria-hidden={Boolean(headerSrc)}
            >
              Header Ad Placeholder
            </div>
          </div>
        </aside>
      </AdGate>
    );
  }

  // ---------------- INLINE PLACEMENT (original) ----------------
  return (
    <AdGate type="inline">
      <aside role="complementary" aria-label={ariaLabel} className={`my-4 ${className}`}>
        {children ? (
          children
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <img src={imgSrc} alt={imgAlt} className="block w-full h-auto" />
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="text-sm text-gray-600">Sponsored</div>
              <a
                href={ctaHref}
                onClick={() => trackAdClick("inline", { href: ctaHref })}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-300"
              >
                {ctaText}
              </a>
            </div>
          </div>
        )}
      </aside>
    </AdGate>
  );
}
// --- REPLACE END ---


