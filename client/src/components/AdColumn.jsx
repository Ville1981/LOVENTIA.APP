// PATH: client/src/components/AdColumn.jsx
// File: client/src/components/AdColumn.jsx

// --- REPLACE START: robust fallbacks & stable layout (CLS-safe); avoid duplicate gating ---
import React, { useMemo } from "react";

import { leftAds, rightAds } from "../utils/adsData";
import "../styles/ads.css";

/**
 * AdColumn
 * Renders up to two side ads with robust fallbacks and stable sizing.
 *
 * Notes:
 * - Keeps existing data source (leftAds/rightAds) intact.
 * - Adds a runtime onError fallback chain to avoid broken images (404).
 * - Uses explicit width/height + aspect ratio to reduce layout shift (CLS) and supports lazy loading.
 *
 * IMPORTANT:
 * - Do NOT gate ads here (AdGate/FeatureGate). The parent layout already gates ads.
 *   This avoids duplicate gating/wrappers and keeps behavior consistent.
 *
 * Layout correctness notes (why this exists):
 * - MainLayout reserves side columns via Tailwind grid (col-span-2). On many viewport widths, that
 *   column is NOT 300px wide. If we hard-force 300px here, the right column can overflow off-screen,
 *   making it look like "only left ads exist".
 * - Therefore, the column must be width: 100% of its grid cell, with a reasonable maxWidth that
 *   matches your CSS (.ad-side max-width) so both sides remain visible.
 *
 * Fallback chain per image (deduplicated):
 *   env inline src (left/right) -> VITE_HEADER_AD_SRC -> /ads/ad-{side}1.png -> /ads/header1.png
 */
const AdColumn = ({ side }) => {
  const ads = side === "left" ? leftAds : rightAds;

  const envSideSrc =
    side === "left"
      ? import.meta.env.VITE_INLINE_AD_LEFT_SRC
      : import.meta.env.VITE_INLINE_AD_RIGHT_SRC;

  const headerFallback = import.meta.env.VITE_HEADER_AD_SRC || "/ads/header1.png";
  const sideDefault = `/ads/ad-${side}1.png`;

  // --- REPLACE START: fit into the grid side column (avoid overflow); keep CLS-safe sizing ---
  // Match your current ads.css defaults: .ad constaints are 200x300 (contain).
  // We keep CLS safety via width/height + aspectRatio, but do NOT force 300px wide columns.
  const COLUMN_MAX_WIDTH_PX = 220; // small buffer over 200px to allow padding/border; stays within col-span-2
  const AD_WIDTH = 200;
  const AD_HEIGHT = 300;
  // Two ads stacked + gap (ads.css uses gap: 20px); keep minHeight stable while loading.
  const COLUMN_MIN_HEIGHT_PX = AD_HEIGHT * 2 + 24;
  // --- REPLACE END ---

  // Compute initial src with a light-weight fallback (no state needed)
  const initialSrc = (ad) => ad?.src || envSideSrc || headerFallback;

  // Build a de-duplicated fallback chain for stability
  const fallbackChain = useMemo(() => {
    const chain = [envSideSrc, headerFallback, sideDefault, "/ads/header1.png"].filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const item of chain) {
      if (!seen.has(item)) {
        seen.add(item);
        unique.push(item);
      }
    }
    return unique;
  }, [envSideSrc, headerFallback, sideDefault]);

  /**
   * onError handler with a short fallback chain.
   * Prevents infinite loops by using dataset.fallbackStep.
   *
   * Key correctness detail:
   * - When we compute an absolute URL for comparison, we also set that resolved absolute URL.
   *   This avoids subtle mismatch/looping between relative vs absolute comparisons.
   */
  const onImgError = (e) => {
    const img = e.currentTarget;

    let step = img.dataset.fallbackStep ? parseInt(img.dataset.fallbackStep, 10) : 0;
    if (!Number.isFinite(step) || step < 0) step = 0;

    while (step < fallbackChain.length) {
      const next = fallbackChain[step];
      step += 1;
      img.dataset.fallbackStep = String(step);

      try {
        if (typeof window !== "undefined" && window?.location?.origin) {
          const resolvedAbs = new URL(next, window.location.origin).href;

          // If we're already on this URL (absolute), try the next candidate.
          if (img.src === resolvedAbs) continue;

          img.src = resolvedAbs;
          return;
        }

        // Fallback without absolute URL comparison (tests/SSR)
        const currentAttr = img.getAttribute("src");
        if (currentAttr === next) continue;

        img.setAttribute("src", next);
        return;
      } catch {
        // If URL parsing fails, still attempt to set src
        if (img.getAttribute("src") === next) continue;
        img.src = next;
        return;
      }
    }

    // If all else fails, hide broken image gracefully
    img.style.display = "none";
  };

  return (
    <div
      className={`ad-column ${side}`}
      // --- REPLACE START: width must follow grid cell; never force 300px ---
      style={{
        width: "100%",
        maxWidth: COLUMN_MAX_WIDTH_PX,
        minHeight: COLUMN_MIN_HEIGHT_PX,
      }}
      // --- REPLACE END ---
    >
      {ads.slice(0, 2).map((ad, index) => (
        <a
          key={index}
          href={ad.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          aria-label={ad.alt || `Side advertisement ${index + 1}`}
        >
          <img
            src={initialSrc(ad)}
            alt={ad.alt || `Ad ${index + 1}`}
            className="ad-side"
            loading="lazy"
            width={AD_WIDTH}
            height={AD_HEIGHT}
            onError={onImgError}
            decoding="async"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              // Ensures the browser can reserve space instantly even before the image loads.
              aspectRatio: `${AD_WIDTH} / ${AD_HEIGHT}`,
              // Keep behavior consistent with ads.css (.ad-side uses contain).
              objectFit: "contain",
            }}
          />
        </a>
      ))}
    </div>
  );
};

export default AdColumn;
// --- REPLACE END ---

