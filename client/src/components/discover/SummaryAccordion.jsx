// src/components/discover/SummaryAccordion.jsx

import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * SummaryAccordion
 *
 * Renders a summary text that can be expanded/collapsed.
 * Ensures a consistent collapsed height to avoid layout shifts.
 */
const SummaryAccordion = ({ summary = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // If no summary, render nothing (no section)
  if (!summary) {
    return null;
  }

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  return (
    <div className="mt-6" style={{ overflowAnchor: 'none' }}>
      <div className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold">
        My self-summary
      </div>
      <div
        className="border border-gray-200 border-t-0 rounded-b-lg p-2"
        style={{ overflowAnchor: 'none' }}
      >
        <p
          className={`text-gray-800 text-sm ${!isExpanded ? 'line-clamp-2' : ''}`}
          style={{
            overflowAnchor: 'none',
            // Maintain a two-line height when collapsed (approx. 3rem)
            minHeight: !isExpanded ? '3rem' : undefined,
          }}
        >
          {summary}
        </p>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.currentTarget.blur()}
          onClick={toggleExpand}
          className="text-[#005FFF] text-xs font-medium mt-1 focus:outline-none"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
    </div>
  );
};

SummaryAccordion.propTypes = {
  summary: PropTypes.string,
};

export default React.memo(SummaryAccordion);
