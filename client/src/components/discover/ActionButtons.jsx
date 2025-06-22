// src/components/discover/ActionButtons.jsx

import React from "react";
import PropTypes from "prop-types";

const ActionButtons = ({ userId, onPass, onLike, onSuperlike }) => {
  return (
    <div className="mt-4 flex justify-between space-x-2">
      <button
        type="button"
        className="flex-1 border-2 border-black text-black py-2 rounded-full hover:bg-gray-100 transition duration-150"
        onClick={(e) => {
          e.preventDefault();
          onPass(userId);
        }}
      >
        ❌ Pass
      </button>
      <button
        type="button"
        className="flex-1 bg-[#FF4081] text-white py-2 rounded-full hover:opacity-90 transition duration-150"
        onClick={(e) => {
          e.preventDefault();
          onLike(userId);
        }}
      >
        ❤️ Like
      </button>
      <button
        type="button"
        className="flex-1 bg-[#005FFF] text-white py-2 rounded-full hover:opacity-90 transition duration-150 flex items-center justify-center space-x-1"
        onClick={(e) => {
          e.preventDefault();
          onSuperlike(userId);
        }}
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
