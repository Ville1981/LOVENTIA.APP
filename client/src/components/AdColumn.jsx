// File: client/src/components/AdColumn.jsx

// --- REPLACE START: robust side ads with fallbacks and stable layout (minimal changes, full file) ---
import React from "react";

import { leftAds, rightAds } from "../utils/adsData";
import "../styles/ads.css";

/**
 * AdColumn
 * Renders up to two side ads with robust fallbacks and stable sizing.
 * - Keeps existing data source (leftAds/rightAds) intact.
 * - Adds runtime onError fallback chain to avoid broken images (404).
 * - Uses explicit width/height to reduce layout shift and lazy loading.
 *
 * Fallback chain per image:
 *   ad.src -> VITE_INLINE_AD_LEFT_SRC/RIGHT -> VITE_HEADER_AD_SRC -> /ads/ad-{side}1.png -> /ads/header1.png
 */
const AdColumn = ({ side }) => {
  const ads = side === "left" ? leftAds : rightAds;

  const envSideSrc =
    side === "left"
      ? import.meta.env.VITE_INLINE_AD_LEFT_SRC
      : import.meta.env.VITE_INLINE_AD_RIGHT_SRC;

  const headerFallback = import.meta.env.VITE_HEADER_AD_SRC || "/ads/header1.png";
  const sideDefault = `/ads/ad-${side}1.png`;

  // Compute initial src with a light-weight fallback (no state needed)
  const initialSrc = (ad) => ad.src || envSideSrc || headerFallback;

  // onError handler with a short fallback chain, prevents infinite loops via dataset flag
  const onImgError = (e) => {
    const img = e.currentTarget;
    const tried = img.dataset.fallbackStep ? parseInt(img.dataset.fallbackStep, 10) : 0;

    // Ordered fallbacks
    const chain = [
      envSideSrc,       // 1) side-specific env
      headerFallback,   // 2) header env or default header
      sideDefault,      // 3) side default
      "/ads/header1.png", // 4) final hard fallback
    ].filter(Boolean);

    if (tried < chain.length) {
      img.dataset.fallbackStep = String(tried + 1);
      const next = chain[tried];
      if (next && img.src !== new URL(next, window.location.origin).href) {
        img.src = next;
        return;
      }
    }

    // If all else fails, hide broken image container gracefully
    img.style.display = "none";
  };

  return (
    <div className={`ad-column ${side}`}>
      {ads.slice(0, 2).map((ad, index) => (
        <a
          key={index}
          href={ad.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img
            src={initialSrc(ad)}
            alt={ad.alt || `Ad ${index + 1}`}
            className="ad-side"
            loading="lazy"
            width={300}
            height={600}
            onError={onImgError}
          />
        </a>
      ))}
    </div>
  );
};

export default AdColumn;
// --- REPLACE END ---
