// client/src/components/discover/SummaryAccordion.jsx

import React, { useState } from "react";
import PropTypes from "prop-types";

const SummaryAccordion = ({ summary = "" }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold">
        My self-summary
      </div>
      <div className="border border-gray-200 border-t-0 rounded-b-lg p-2">
        <p className={`text-gray-800 text-sm ${!isExpanded ? "line-clamp-2" : ""}`}>
          {summary}
        </p>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[#005FFF] text-xs font-medium mt-1"
          type="button"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>
    </div>
  );
};

SummaryAccordion.propTypes = {
  summary: PropTypes.string,
};

export default React.memo(SummaryAccordion);
