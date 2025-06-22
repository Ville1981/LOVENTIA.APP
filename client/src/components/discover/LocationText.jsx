import React from "react";
import PropTypes from "prop-types";

const LocationText = ({ city = "", region = "", country = "" }) => {
  const parts = [];
  if (city) parts.push(city);
  if (region) parts.push(region);
  if (country) parts.push(country);
  const text = parts.join(", ") || "Unknown location";

  return <p className="text-gray-500">{text}</p>;
};

LocationText.propTypes = {
  city:    PropTypes.string,
  region:  PropTypes.string,
  country: PropTypes.string,
};

export default React.memo(LocationText);
