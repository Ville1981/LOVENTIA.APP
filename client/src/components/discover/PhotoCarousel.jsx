import React from "react";
import PropTypes from "prop-types";
import Slider from "react-slick";

// slick-tyylit
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const PhotoCarousel = ({ photos = [] }) => {
  const photoList = Array.isArray(photos) ? photos : [];

  if (photoList.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        No images available
      </div>
    );
  }

  // lähdeosoitteet stringiksi
  const photoKey = photoList
    .map((item) => (typeof item === "string" ? item : item.url || ""))
    .join("|");

  const settings = {
    dots: true,
    arrows: true,
    infinite: false,
    speed: 300,
    slidesToShow: 3,
    slidesToScroll: 1,
    adaptiveHeight: false,
  };

  return (
    // kiinteä korkeus 12rem (h-48), overflow hidden
    <div className="relative w-full h-48 overflow-hidden">
      <Slider key={photoKey} {...settings}>
        {photoList.map((item, idx) => {
          const raw =
            typeof item === "string" ? item : item.url || "";
          const src = raw.startsWith("http")
            ? raw
            : `${window.location.origin}${raw.startsWith("/") ? "" : "/"}${raw}`;

          return (
            <div key={idx} className="px-1">
              <img
                src={src}
                alt={`Photo ${idx + 1}`}
                className="w-full h-48 object-cover rounded-md"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = photoList[0] || "";
                }}
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

export default React.memo(PhotoCarousel);
