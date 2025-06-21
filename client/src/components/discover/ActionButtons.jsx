// client/src/components/discover/ActionButtons.jsx
import React from "react";
import PropTypes from "prop-types";

const ActionButtons = ({ userId, onAction }) => {
  return (
    <div className="mt-4 flex justify-between space-x-2">
      <button
        className="flex-1 border-2 border-black text-black py-2 rounded-full hover:bg-gray-100 transition duration-150"
        onClick={() => onAction(userId, "pass")}
      >
        ❌ Pass
      </button>
      <button
        className="flex-1 bg-[#FF4081] text-white py-2 rounded-full hover:opacity-90 transition duration-150"
        onClick={() => onAction(userId, "like")}
      >
        ❤️ Like
      </button>
      <button
        className="flex-1 bg-[#005FFF] text-white py-2 rounded-full hover:opacity-90 transition duration-150 flex items-center justify-center space-x-1"
        onClick={() => onAction(userId, "superlike")}
      >
        <span>⭐</span>
        <span>Superlike</span>
      </button>
    </div>
  );
};

ActionButtons.propTypes = {
  userId:   PropTypes.string.isRequired,
  onAction: PropTypes.func.isRequired,
};

export default React.memo(ActionButtons);
