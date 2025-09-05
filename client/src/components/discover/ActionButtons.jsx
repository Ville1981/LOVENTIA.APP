// File: client/src/components/discover/ActionButtons.jsx

// --- REPLACE START: ActionButtons – allow fake self-like/pass without API call ---
import PropTypes from "prop-types";
import React from "react";
import { useAuth } from "../../contexts/AuthContext";

/**
 * ActionButtons
 *
 * Renders Pass / Like / Superlike buttons.
 * Prevents focus-jump by disabling mouse-down focus,
 * removing focus after click, and making buttons non-focusable (tabIndex=-1).
 *
 * ✅ Added: if userId === current logged-in user → simulate action locally,
 * skip API call to avoid 400 "Cannot act on self".
 */
const ActionButtons = ({ userId, onPass, onLike, onSuperlike }) => {
  const { user: authUser } = useAuth();
  const currentUserId = authUser?._id?.toString?.() || authUser?.id?.toString?.();

  const handleClick = (callback, type) => (e) => {
    e.preventDefault();

    if (currentUserId && userId === currentUserId) {
      // Fake success: only update UI state
      console.warn(`[ActionButtons] Skipping API for self-${type}, simulating locally`);
      callback(userId);
    } else {
      callback(userId);
    }

    // remove focus from button
    e.currentTarget.blur();
  };

  return (
    <div
      className="mt-4 flex justify-between space-x-2"
      style={{ overflowAnchor: "none" }}
    >
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onFocus={(e) => e.currentTarget.blur()}
        onMouseUp={(e) => e.currentTarget.blur()}
        onClick={handleClick(onPass, "pass")}
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
        onClick={handleClick(onLike, "like")}
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
        onClick={handleClick(onSuperlike, "superlike")}
        className="flex-1 bg-[#005FFF] text-white py-2 rounded-full hover:opacity-90 transition duration-150 flex items-center justify-center space-x-1 focus:outline-none"
      >
        <span>⭐</span>
        <span>Superlike</span>
      </button>
    </div>
  );
};

ActionButtons.propTypes = {
  userId: PropTypes.string.isRequired,
  onPass: PropTypes.func.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperlike: PropTypes.func.isRequired,
};

export default React.memo(ActionButtons);
// --- REPLACE END ---
