import React from "react";
import PropTypes from "prop-types";
import Slider from "react-slick";

// Tärkeää: nämä tyylit täytyy tuoda, muuten karuselli ei skaalau eikä nuolet näy
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const PhotoCarousel = ({ photos = [] }) => {
  // Jos ei ole yhtään kuvaa, näytetään selkeä viesti
  if (!Array.isArray(photos) || photos.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        Ei kuvia saatavilla
      </div>
    );
  }

  const settings = {
    dots: true,
    arrows: true,
    infinite: false,
    speed: 300,
    slidesToShow: 1,
    slidesToScroll: 1,
    adaptiveHeight: true,
  };

  return (
    <div className="relative">
      <Slider {...settings}>
        {photos.map((src, idx) => (
          <div key={idx} className="overflow-hidden">
            <img
              src={src}
              alt={`Photo ${idx + 1}`}
              className="w-full h-64 object-cover"
            />
          </div>
        ))}
      </Slider>
    </div>
  );
};

PhotoCarousel.propTypes = {
  photos: PropTypes.arrayOf(PropTypes.string),
};

export default React.memo(PhotoCarousel);
