// src/components/discover/PhotoCarousel.jsx

import React, { memo } from "react";
import PropTypes from "prop-types";
import Slider from "react-slick";

// slick-carouselin CSS (ei poistoja!)
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/**
 * Custom non-focusable arrow buttons for slick
 */
const PrevArrow = ({ onClick }) => (
  <button
    type="button"
    className="slick-prev slick-arrow"
    tabIndex={-1}
    onClick={onClick}
    onMouseDown={(e) => e.preventDefault()}
    onMouseUp={(e) => e.currentTarget.blur()}
    style={{ display: "block" }}
  />
);
const NextArrow = ({ onClick }) => (
  <button
    type="button"
    className="slick-next slick-arrow"
    tabIndex={-1}
    onClick={onClick}
    onMouseDown={(e) => e.preventDefault()}
    onMouseUp={(e) => e.currentTarget.blur()}
    style={{ display: "block" }}
  />
);

const PhotoCarousel = ({ photos = [] }) => {
  const photoList = Array.isArray(photos) ? photos : [];

  if (photoList.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        No images available
      </div>
    );
  }

  // key vaihtuu, jos photoList muuttuu
  const photoKey = photoList
    .map((item) =>
      typeof item === "string" ? item : item.url || ""
    )
    .join("|");

  const settings = {
    dots: true,
    arrows: true,
    infinite: false,
    speed: 300,
    slidesToShow: 3,
    slidesToScroll: 1,
    adaptiveHeight: false,

    // custom arrows
    prevArrow: <PrevArrow />,
    nextArrow: <NextArrow />,

    // estä fokusointi + swipe/drag
    accessibility: false,
    focusOnSelect: false,
    pauseOnFocus: false,
    pauseOnHover: false,
    swipe: false,
    swipeToSlide: false,
    draggable: false,
  };

  return (
    <div
      className="relative w-full h-48 overflow-hidden"
      tabIndex={-1}
    >
      <Slider key={photoKey} {...settings}>
        {photoList.map((item, idx) => {
          const raw =
            typeof item === "string" ? item : item.url || "";
          const src = raw.startsWith("http")
            ? raw
            : `${window.location.origin}${
                raw.startsWith("/") ? "" : "/"
              }${raw}`;

          return (
            <div key={idx} className="px-1" tabIndex={-1}>
              <img
                src={src}
                alt={`Photo ${idx + 1}`}
                className="w-full h-48 object-cover rounded-md"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  const fb = photoList[0];
                  const fallback =
                    typeof fb === "string"
                      ? fb
                      : fb?.url || "";
                  e.currentTarget.src = fallback.startsWith("http")
                    ? fallback
                    : `${window.location.origin}${
                        fallback.startsWith("/") ? "" : "/"
                      }${fallback}`;
                }}
                tabIndex={-1}
                draggable={false}
              />
            </div>
          );
        })}
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

PhotoCarousel.defaultProps = {
  photos: [],
};

export default memo(PhotoCarousel);
