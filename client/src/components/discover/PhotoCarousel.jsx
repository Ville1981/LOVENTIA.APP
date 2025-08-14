// src/components/discover/PhotoCarousel.jsx

import PropTypes from "prop-types";
import React, { memo, useRef, useEffect, useMemo } from "react";
import Slider from "react-slick";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// --- REPLACE START: use backend base + robust path normalization ---
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from "../../config";

/** Normalize Windows backslashes and ensure single leading slash */
const normalizePath = (p = "") =>
  "/" + String(p).replace(/\\/g, "/").replace(/^\/+/, "");

/** Resolve any image source (absolute http(s) or backend-relative) */
function resolveSrc(raw = "") {
  const s = String(raw || "");
  if (!s) return PLACEHOLDER_IMAGE;
  if (/^https?:\/\//i.test(s)) return s;
  return `${BACKEND_BASE_URL}${normalizePath(s)}`;
}
// --- REPLACE END ---

const PrevArrow = ({ onClick }) => (
  <button
    type="button"
    className="slick-prev slick-arrow"
    tabIndex={-1}
    onClick={(e) => {
      e.preventDefault();
      onClick();
      document.activeElement?.blur();
    }}
    onMouseDown={(e) => e.preventDefault()}
    onMouseUp={(e) => e.currentTarget.blur()}
    onFocus={(e) => e.currentTarget.blur()}
    style={{ display: "block", overflowAnchor: "none" }}
  />
);

const NextArrow = ({ onClick }) => (
  <button
    type="button"
    className="slick-next slick-arrow"
    tabIndex={-1}
    onClick={(e) => {
      e.preventDefault();
      onClick();
      document.activeElement?.blur();
    }}
    onMouseDown={(e) => e.preventDefault()}
    onMouseUp={(e) => e.currentTarget.blur()}
    onFocus={(e) => e.currentTarget.blur()}
    style={{ display: "block", overflowAnchor: "none" }}
  />
);

const PhotoCarousel = ({ photos = [] }) => {
  const photoList = Array.isArray(photos) ? photos : [];

  // --- REPLACE START: normalize keys and URLs once (prevents flicker and broken images) ---
  const normalized = useMemo(
    () =>
      photoList.map((item) => {
        const raw = typeof item === "string" ? item : item?.url || "";
        return { raw, src: resolveSrc(raw) };
      }),
    [photoList]
  );
  const photoKey = normalized.map((p) => p.src).join("|");
  // --- REPLACE END ---

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
    sliderRef.current?.slickGoTo(0, /* dontAnimate */ true);
  }, [photoKey]);

  // --- REPLACE START: enable autoplay only when it makes sense ---
  const enableAutoplay = normalized.length > 1;
  // --- REPLACE END ---

  const settings = {
    initialSlide: 0,
    dots: false,
    arrows: true,
    // --- REPLACE START: autoplay + infinite based on photo count ---
    infinite: enableAutoplay,
    autoplay: enableAutoplay,
    autoplaySpeed: 3000,
    // --- REPLACE END ---
    speed: 300,
    slidesToShow: 3,
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

  if (normalized.length === 0) {
    return (
      <div
        className="p-6 text-center text-gray-500"
        style={{ overflowAnchor: "none" }}
      >
        No images available
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
  photos: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({ url: PropTypes.string }),
    ])
  ),
};

export default memo(PhotoCarousel);
