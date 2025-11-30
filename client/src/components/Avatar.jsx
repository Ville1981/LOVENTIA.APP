// File: client/src/components/Avatar.jsx
// Reusable Avatar component with fallback image
import PropTypes from "prop-types";
import React from "react";
import { absolutizeImage } from "../utils/absolutizeImage";

// Stable fallback for all avatars in the app
// Uses the existing placeholder avatar under the public root.
const FALLBACK_AVATAR = "/placeholder-avatar.png";

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

  // Normalize the incoming src so it works with /uploads, absolute URLs and placeholders
  let resolvedSrc = src || FALLBACK_AVATAR;
  try {
    resolvedSrc = absolutizeImage(resolvedSrc);
  } catch {
    // If absolutizeImage throws for some unexpected value, fall back silently
    resolvedSrc = src || FALLBACK_AVATAR;
  }

  const handleError = (e) => {
    // --- REPLACE START
    // Fallback to default avatar on error
    e.currentTarget.onerror = null;
    e.currentTarget.src = FALLBACK_AVATAR;
    // --- REPLACE END
  };

  return (
    <img
      src={resolvedSrc}
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
  src: FALLBACK_AVATAR,
  alt: "User avatar",
  size: 40,
};
