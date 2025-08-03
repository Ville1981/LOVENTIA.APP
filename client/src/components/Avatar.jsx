// src/components/Avatar.jsx
// Reusable Avatar component with fallback image
import PropTypes from "prop-types";
import React from "react";

/**
 * Avatar
 * @param {string} src - Image URL
 * @param {string} alt - Alt text
 * @param {number} size - Width/height in pixels
 */
export default function Avatar({ src, alt, size = 40 }) {
  const style = {
    width: size,
    height: size,
    borderRadius: "50%",
    objectFit: "cover",
  };

  const handleError = (e) => {
    // --- REPLACE START
    // Fallback to default avatar on error
    e.currentTarget.src = "/assets/default-avatar.png";
    // --- REPLACE END
  };

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      onError={handleError}
      loading="lazy"
    />
  );
}

Avatar.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.number,
};

Avatar.defaultProps = {
  src: "/assets/default-avatar.png",
  alt: "User avatar",
  size: 40,
};
