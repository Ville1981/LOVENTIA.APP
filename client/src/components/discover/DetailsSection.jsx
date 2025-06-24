// src/components/discover/DetailsSection.jsx

import React from "react";
import PropTypes from "prop-types";

const DetailsSection = ({ details = {} }) => {
  if (typeof details !== "object" || Object.keys(details).length === 0) return null;

  return (
    <div
      className="mt-6 focus:outline-none"
      tabIndex={-1}
      style={{
        overflowAnchor: "none",  // estää scroll-ankkuroinnin
        minHeight: "5rem",       // takaa vakauden eri profiileilla
      }}
    >
      <div
        className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold focus:outline-none"
        tabIndex={-1}
        style={{ overflowAnchor: "none" }}
      >
        Details
      </div>
      <div
        className="border border-gray-200 border-t-0 rounded-b-lg p-4 flex flex-col space-y-2 text-gray-700 text-sm focus:outline-none"
        tabIndex={-1}
        style={{
          overflowAnchor: "none",
          minHeight: "4rem",    // vakioidaan sisällön minikorkeus
        }}
      >
        {details.gender && (
          <div className="flex items-center space-x-2">
            <span>👤</span>
            <span>
              {details.gender} | {details.orientation} | {details.relationshipStatus}
            </span>
          </div>
        )}
        {details.bodyType && (
          <div className="flex items-center space-x-2">
            <span>💪</span>
            <span>{details.bodyType}</span>
          </div>
        )}
        {details.ethnicity && (
          <div className="flex items-center space-x-2">
            <span>🌐</span>
            <span>
              {details.ethnicity} | {details.languages?.join(", ")} | {details.education} | {details.employment} | {details.religion}
            </span>
          </div>
        )}
        {(details.smoking || details.drinking || details.marijuana || details.diet) && (
          <div className="flex items-center space-x-2">
            <span>🚬</span>
            <span>
              {details.smoking} | {details.drinking} | {details.marijuana} | {details.diet}
            </span>
          </div>
        )}
        {details.kids && (
          <div className="flex items-center space-x-2">
            <span>👶</span>
            <span>{details.kids}</span>
          </div>
        )}
        {details.pets && (
          <div className="flex items-center space-x-2">
            <span>🐾</span>
            <span>{details.pets}</span>
          </div>
        )}
        {details.lookingFor && (
          <div className="flex items-center space-x-2">
            <span>🔍</span>
            <span>{details.lookingFor}</span>
          </div>
        )}
      </div>
    </div>
  );
};

DetailsSection.propTypes = {
  details: PropTypes.shape({
    gender:             PropTypes.string,
    orientation:        PropTypes.string,
    relationshipStatus: PropTypes.string,
    bodyType:           PropTypes.string,
    ethnicity:          PropTypes.string,
    languages:          PropTypes.arrayOf(PropTypes.string),
    education:          PropTypes.string,
    employment:         PropTypes.string,
    religion:           PropTypes.string,
    smoking:            PropTypes.string,
    drinking:           PropTypes.string,
    marijuana:          PropTypes.string,
    diet:               PropTypes.string,
    kids:               PropTypes.string,
    pets:               PropTypes.string,
    lookingFor:         PropTypes.string,
  }),
};

export default React.memo(DetailsSection);
