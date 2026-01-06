// PATH: client/src/components/HeaderAdSlot.jsx

import React, { useMemo, useState } from "react";
import AdGate from "./AdGate"; // hides on Premium / noAds feature

export default function HeaderAdSlot({ className = "" }) {
  const initialSrc = useMemo(() => {
    let s = "/ads/header1.png";
    try {
      const envSrc = import.meta?.env?.VITE_HEADER_AD_SRC;
      if (typeof envSrc === "string" && envSrc.trim()) s = envSrc.trim();
    } catch {
      // best-effort only
    }
    return s;
  }, []);

  const [src, setSrc] = useState(initialSrc);

  // CLS-safe reserved space
  const H = 150;
  const MAX_W = 960;

  // Fill more horizontally while keeping text mostly safe
  const FOREGROUND_ZOOM = 1.22; // tweak 1.18 -> 1.22 (covers more width)

  // Background tuning: less “muddy blur”
  const BG_BLUR_PX = 6;         // was 10
  const BG_SCALE = 1.12;        // slightly enlarged so blur edges won't show
  const BG_OPACITY = 0.55;      // keep it subtle so it won't look messy

  const wrapStyles = {
    position: "relative",
    width: "100%",
    height: `${H}px`,
    overflow: "hidden",
    borderRadius: "12px",
    background: "rgba(0,0,0,0.06)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
  };

  const bgImgStyles = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    transform: `scale(${BG_SCALE})`,
    filter: `blur(${BG_BLUR_PX}px) saturate(1.05)`,
    opacity: BG_OPACITY,
    pointerEvents: "none",
  };

  // Overlay hides blur artifacts + makes edges feel “clean” (not suttuinen)
  const overlayStyles = {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.18))",
    pointerEvents: "none",
  };

  const fgImgStyles = {
    position: "relative",
    zIndex: 1,
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
    transform: `scale(${FOREGROUND_ZOOM})`,
    transformOrigin: "center",
  };

  return (
    // Mobiilissa ei pakko näkyä (sun toive): hidden md:block
    <div
      className={`promo-header-wrap w-full hidden md:block ${className}`}
      role="complementary"
      aria-label="Header advertisement"
    >
      {/* Gate ulommaksi -> jos piilottaa, EI jää tyhjää laatikkoa */}
      <AdGate type="inline" debug={false}>
        <div className="mx-auto w-full px-4" style={{ maxWidth: MAX_W }}>
          <div style={wrapStyles}>
            {/* Background image layer (less “muddy” than CSS background-image) */}
            <img aria-hidden="true" src={src} alt="" style={bgImgStyles} />
            <div aria-hidden="true" style={overlayStyles} />

            {/* Foreground image layer (keeps text readable) */}
            <img
              src={src}
              alt="Sponsored"
              className="promo-header-img w-full"
              style={fgImgStyles}
              width={MAX_W}
              height={H}
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              onError={() => {
                if (src !== "/ads/header1.png") setSrc("/ads/header1.png");
              }}
            />
          </div>
        </div>
      </AdGate>
    </div>
  );
}

