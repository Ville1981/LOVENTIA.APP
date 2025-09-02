// PATH: client/src/components/discover/PhotoCarousel.jsx

import PropTypes from "prop-types";
import React, { memo, useRef, useEffect, useMemo } from "react";
import Slider from "react-slick";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// --- REPLACE START: canonical prop = photos; path normalization; BACKEND_BASE_URL only for relative paths; autoplay when ≥2 valid URLs and no prefers-reduced-motion ---
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from "../../config";

/** Normalize Windows backslashes and ensure a single leading slash */
const normalizePath = (p = "") =>
  "/" + String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");

/** Resolve any image source (absolute http(s) or backend-relative).
 *  IMPORTANT: return empty string for invalid inputs so we can later
 *  filter them out and only count truly valid image URLs.
 */
function resolveSrc(raw = "") {
  const s = String(raw || "");
  if (!s) return ""; // invalid → filtered out later
  if (/^https?:\/\//i.test(s)) return s; // absolute URL OK
  return `${BACKEND_BASE_URL}${normalizePath(s)}`; // relative → prepend backend
}

/** Read user's autoplay preference from localStorage (truthy by default). */
function readAutoplayPref() {
  try {
    const v =
      localStorage.getItem("carouselAutoplay") ??
      localStorage.getItem("loventia.carousel.autoplay");
    if (v == null) return true; // default ON unless user disables
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["0", "off", "false", "no"].includes(s)) return false;
      if (["1", "on", "true", "yes"].includes(s)) return true;
    }
    return !!v;
  } catch {
    return true;
  }
}

/** Respect system setting: prefers-reduced-motion → disable autoplay. */
function prefersReducedMotion() {
  try {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
// --- REPLACE END ---

const PrevArrow = ({ onClick }) => (
  <button
    type="button"
    className="slick-prev slick-arrow"
    tabIndex={-1}
    onClick={(e) => {
      e.preventDefault();
      onClick?.();
      document.activeElement?.blur();
    }}
    onMouseDown={(e) => e.preventDefault()}
    onMouseUp={(e) => e.currentTarget.blur()}
    onFocus={(e) => e.currentTarget.blur()}
    style={{ display: "block", overflowAnchor: "none" }}
    aria-label="Previous"
  />
);

const NextArrow = ({ onClick }) => (
  <button
    type="button"
    className="slick-next slick-arrow"
    tabIndex={-1}
    onClick={(e) => {
      e.preventDefault();
      onClick?.();
      document.activeElement?.blur();
    }}
    onMouseDown={(e) => e.preventDefault()}
    onMouseUp={(e) => e.currentTarget.blur()}
    onFocus={(e) => e.currentTarget.blur()}
    style={{ display: "block", overflowAnchor: "none" }}
    aria-label="Next"
  />
);

const PhotoCarousel = ({ photos = [], images /* deprecated alias, tolerated */ }) => {
  // Keep a single canonical list. If old prop `images` is provided and `photos` is empty, use it.
  const photoList = useMemo(() => {
    if (Array.isArray(photos) && photos.length) return photos;
    if (Array.isArray(images) && images.length) return images; // backward compatibility
    return [];
  }, [photos, images]);

  // Build a deterministic dependency key from content (not array reference).
  const depKey = useMemo(() => {
    try {
      return (Array.isArray(photoList) ? photoList : [])
        .filter(Boolean)
        .map((item) => (typeof item === "string" ? item : item?.url || ""))
        .map((s) => String(s || ""))
        .join("|");
    } catch {
      return "";
    }
  }, [photoList]);

  // Normalize once; use depKey so reference only changes when content changes.
  const normalized = useMemo(() => {
    const list = (Array.isArray(photoList) ? photoList : []).filter(Boolean);
    const mapped = list
      .map((item) => (typeof item === "string" ? item : item?.url || ""))
      .map((raw) => {
        const src = resolveSrc(raw);
        return { raw, src };
      })
      // Filter out invalid/empty after resolution to ensure "valid URL" check works
      .filter((x) => typeof x.src === "string" && x.src.length > 0);

    // If nothing valid, fall back to one placeholder for graceful UI (count=1 → no autoplay)
    return mapped.length ? mapped : [{ raw: "", src: PLACEHOLDER_IMAGE }];
  }, [depKey]);

  const photoKey = normalized.map((p) => p.src).join("|"); // used to reset slider on real content change

  const sliderRef = useRef(null);
  const prevScrollY = useRef(0);

  const handleBeforeChange = () => {
    prevScrollY.current = window.scrollY;
    document.activeElement?.blur();
  };

  const handleAfterChange = () => {
    setTimeout(() => {
      window.scrollTo(0, prevScrollY.current);
      document.activeElement?.blur();
    }, 0);
  };

  useEffect(() => {
    // When data changes, reset to first slide without animation flicker
    sliderRef.current?.slickGoTo(0, /* dontAnimate */ true);
  }, [photoKey]);

  // Strict behavior — for ≤1 valid image disable arrows/infinite/autoplay.
  const count = normalized.length;
  const enableCarousel = count > 1;

  // Autoplay policy:
  // - require at least 2 valid URLs
  // - AND user hasn't disabled it in localStorage
  // - AND system doesn't request reduced motion
  const autoplayAllowed = useMemo(() => readAutoplayPref(), []);
  const reduceMotion = useMemo(() => prefersReducedMotion(), []);
  const autoplayFinal = enableCarousel && autoplayAllowed && !reduceMotion;

  const slidesToShow = Math.min(3, Math.max(1, count)); // keep existing behavior

  const settings = {
    initialSlide: 0,
    dots: false,
    arrows: enableCarousel,
    infinite: enableCarousel,
    autoplay: autoplayFinal, // <- respects user + system prefs
    autoplaySpeed: 3000,
    speed: 300,
    slidesToShow,
    slidesToScroll: 1,
    adaptiveHeight: false,

    prevArrow: <PrevArrow />,
    nextArrow: <NextArrow />,

    accessibility: false,
    focusOnSelect: false,
    focusOnChange: false,
    pauseOnFocus: false,
    pauseOnHover: false,
    swipe: false,
    swipeToSlide: false,
    draggable: false,

    beforeChange: handleBeforeChange,
    afterChange: handleAfterChange,
  };

  if (count === 0) {
    // With the fallback above, this should not happen, but keep for safety.
    return (
      <div
        className="p-6 text-center text-gray-500"
        style={{ overflowAnchor: "none" }}
      >
        No images available
      </div>
    );
  }

  // For a single image, render a simple block (no Slider) to avoid overhead and arrow UI
  if (count === 1) {
    const only = normalized[0];
    return (
      <div className="relative w-full h-[400px] overflow-hidden rounded-md">
        <img
          src={only.src}
          alt="Photo 1"
          className="w-full h-full object-cover"
          draggable={false}
          tabIndex={-1}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[400px] overflow-hidden"
      style={{ overflowAnchor: "none" }}
    >
      <Slider
        ref={sliderRef}
        {...settings}
        className="slick-slider"
        style={{ overflowAnchor: "none" }}
      >
        {normalized.map(({ src }, idx) => (
          <div
            key={`${idx}-${src}`}
            className="px-1"
            style={{ overflowAnchor: "none", height: "100%" }}
          >
            <div className="w-full h-[400px] overflow-hidden rounded-md">
              <img
                src={src}
                alt={`Photo ${idx + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
                tabIndex={-1}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  const fb = normalized[0]?.src || PLACEHOLDER_IMAGE;
                  e.currentTarget.src = fb;
                }}
                style={{ overflowAnchor: "none" }}
              />
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

PhotoCarousel.propTypes = {
  /** Canonical prop (array of strings or {url}) */
  photos: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({ url: PropTypes.string }),
    ])
  ),
  /** Deprecated alias; tolerated for backward-compat only */
  images: PropTypes.array, // do not document externally; use `photos` instead
};

export default memo(PhotoCarousel);




















