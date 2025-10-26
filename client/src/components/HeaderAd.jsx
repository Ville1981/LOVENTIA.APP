// PATH: client/src/components/HeaderAd.jsx

import React, { useEffect, useState } from "react";
import * as adData from "../utils/adsData"; // keep source of header ad creatives

/**
 * HeaderAd
 * Rotates header creatives. This component controls the visual height so the
 * banner is consistently shorter across pages without touching HeroSection.
 */
const HeaderAd = () => {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(false);

  const ads = adData.headerAds;

  useEffect(() => {
    if (!ads || ads.length === 0) return;
    const interval = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % ads.length);
        setFade(false);
      }, 500);
    }, 8000);
    return () => clearInterval(interval);
  }, [ads?.length]);

  if (!ads || ads.length === 0) return null;

  // --- REPLACE START: enforce a shorter, fixed header-ad height (about 50%) ---
  // We wrap the <img> in a fixed-height container and crop with object-cover.
  // Using inline styles ensures this wins over older `.ad-header { height:auto }`.
  // If you want to tweak globally later, move the `height: 150px` to ads.css.
  const WRAPPER_HEIGHT_PX = 150; // previously ~300px via CSS; now ~half
  const src = ads[index]?.src || "/ads/header1.png";
  const alt = ads[index]?.alt || "Header advertisement";
  // --- REPLACE END ---

  return (
    <div className="w-full bg-white pt-0 pb-4 shadow" role="complementary" aria-label="Header advertisement">
      {/* Fixed-height crop container */}
      <div
        className="mx-auto w-full overflow-hidden rounded"
        style={{ height: `${WRAPPER_HEIGHT_PX}px`, maxWidth: 960 }}
      >
        <img
          src={src}
          alt={alt}
          // Keep original class for legacy styling, but explicitly override height/fit here.
          className={`ad-header ${fade ? "fade-out" : ""}`}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default HeaderAd;

