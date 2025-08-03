// src/components/discover/LocationText.jsx

import React from "react";
import PropTypes from "prop-types";

/**
 * LocationText
 *
 * Displays the user's location with a consistent min-height to prevent layout shifts.
 */
const LocationText = ({ city = "", region = "", country = "" }) => {
  const parts = [];
  if (city) parts.push(city);
  if (region) parts.push(region);
  if (country) parts.push(country);
  const text = parts.join(", ") || "Unknown location";

  return (
    <p
      tabIndex={-1}
      className="text-gray-500"
      style={{
        overflowAnchor: "none", // Prevents scroll anchoring
        minHeight: "1.25rem",   // Ensures one-line height consistency
      }}
    >
      {text}
    </p>
  );
};

LocationText.propTypes = {
  city:    PropTypes.string,
  region:  PropTypes.string,
  country: PropTypes.string,
};

export default React.memo(LocationText);
