// PATH: client/src/components/HeaderAd.jsx

import React, { useEffect, useState, useRef } from "react";
import * as adData from "../utils/adsData";

const HeaderAd = () => {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(false);

  const ads = adData.headerAds;

  // Clean interval + timeout (no dangling timers)
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!ads || ads.length === 0) return;

    const interval = setInterval(() => {
      setFade(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      timeoutRef.current = setTimeout(() => {
        setIndex((prev) => (prev + 1) % ads.length);
        setFade(false);
        timeoutRef.current = null;
      }, 500);
    }, 8000);

    return () => {
      clearInterval(interval);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [ads?.length]);

  if (!ads || ads.length === 0) return null;

  const MAX_W = 960;
  const HEIGHT = "clamp(110px, 14vw, 150px)";

  const envHeaderSrc = import.meta.env.VITE_HEADER_AD_SRC || "/ads/header1.png";
  const src = ads[index]?.src || envHeaderSrc;
  const alt = ads[index]?.alt || "Header advertisement";

  return (
    <div className="w-full" role="complementary" aria-label="Header advertisement">
      <div className="mx-auto w-full" style={{ maxWidth: MAX_W }}>
        <div
          className="w-full overflow-hidden rounded-xl"
          style={{
            height: HEIGHT,
            background: "rgba(0,0,0,0.06)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          <img
            src={src}
            alt={alt}
            className={`ad-header ${fade ? "fade-out" : ""}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
            }}
            width={MAX_W}
            height={150}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
};

export default HeaderAd;

