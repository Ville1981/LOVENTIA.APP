// src/components/discover/PhotoCarousel.jsx

import React, { memo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import Slider from 'react-slick';

import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

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
    style={{ display: 'block', overflowAnchor: 'none' }}
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
    style={{ display: 'block', overflowAnchor: 'none' }}
  />
);

const PhotoCarousel = ({ photos = [] }) => {
  const photoList = Array.isArray(photos) ? photos : [];
  const photoKey = photoList
    .map((item) => (typeof item === 'string' ? item : item.url || ''))
    .join('|');

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

  const settings = {
    initialSlide: 0,
    dots: false,
    arrows: true,
    infinite: false,
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

  if (photoList.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500" style={{ overflowAnchor: 'none' }}>
        No images available
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] overflow-hidden" style={{ overflowAnchor: 'none' }}>
      <Slider
        ref={sliderRef}
        {...settings}
        className="slick-slider"
        style={{ overflowAnchor: 'none' }}
      >
        {photoList.map((item, idx) => {
          const raw = typeof item === 'string' ? item : item.url || '';
          const src = raw.startsWith('http')
            ? raw
            : `${window.location.origin}${raw.startsWith('/') ? '' : '/'}${raw}`;

          return (
            <div key={idx} className="px-1" style={{ overflowAnchor: 'none', height: '100%' }}>
              <div className="w-full h-[400px] overflow-hidden rounded-md">
                <img
                  src={src}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                  tabIndex={-1}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    const fb = photoList[0];
                    const fallback = typeof fb === 'string' ? fb : fb.url || '';
                    e.currentTarget.src = fallback.startsWith('http')
                      ? fallback
                      : `${window.location.origin}${fallback.startsWith('/') ? '' : '/'}${fallback}`;
                  }}
                  style={{ overflowAnchor: 'none' }}
                />
              </div>
            </div>
          );
        })}
      </Slider>
    </div>
  );
};

PhotoCarousel.propTypes = {
  photos: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.shape({ url: PropTypes.string })])
  ),
};

export default memo(PhotoCarousel);
