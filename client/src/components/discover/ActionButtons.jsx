// src/components/discover/ActionButtons.jsx

import React from "react";
import PropTypes from "prop-types";

/**
 * ActionButtons
 *
 * Renders Pass / Like / Superlike buttons. Prevents focus-jump by
 * disabling mouse-down focus, removing focus after click, and
 * making buttons permanently non-focusable (tabIndex=-1).
 */
const ActionButtons = ({ userId, onPass, onLike, onSuperlike }) => {
  const handleClick = (callback) => (e) => {
    e.preventDefault();
    callback(userId);
    // poistaa fokuksen napista
    e.currentTarget.blur();
  };

  return (
    <div
      className="mt-4 flex justify-between space-x-2"
      style={{ overflowAnchor: 'none' }}
    >
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onFocus={(e) => e.currentTarget.blur()}
        onMouseUp={(e) => e.currentTarget.blur()}
        onClick={handleClick(onPass)}
        className="flex-1 border-2 border-black text-black py-2 rounded-full hover:bg-gray-100 transition duration-150 focus:outline-none"
      >
        ❌ Pass
      </button>

      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onFocus={(e) => e.currentTarget.blur()}
        onMouseUp={(e) => e.currentTarget.blur()}
        onClick={handleClick(onLike)}
        className="flex-1 bg-[#FF4081] text-white py-2 rounded-full hover:opacity-90 transition duration-150 focus:outline-none"
      >
        ❤️ Like
      </button>

      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onFocus={(e) => e.currentTarget.blur()}
        onMouseUp={(e) => e.currentTarget.blur()}
        onClick={handleClick(onSuperlike)}
        className="flex-1 bg-[#005FFF] text-white py-2 rounded-full hover:opacity-90 transition duration-150 flex items-center justify-center space-x-1 focus:outline-none"
      >
        <span>⭐</span>
        <span>Superlike</span>
      </button>
    </div>
  );
};

ActionButtons.propTypes = {
  userId:      PropTypes.string.isRequired,
  onPass:      PropTypes.func.isRequired,
  onLike:      PropTypes.func.isRequired,
  onSuperlike: PropTypes.func.isRequired,
};

export default React.memo(ActionButtons);
