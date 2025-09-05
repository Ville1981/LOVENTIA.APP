// File: client/src/components/discover/StatsPanel.jsx

// --- REPLACE START: StatsPanel – neutral placeholders + robust URL normalization (no Bunny fallback) ---
import PropTypes from "prop-types";
import React from "react";
import { PLACEHOLDER_IMAGE } from "../../utils/config";
import { absolutizeImage } from "../../utils/absolutizeImage";

/**
 * StatsPanel
 * - Shows "You & {displayName}" mini-row with two avatars and compatibility.
 * - IMPORTANT: Never use the Bunny demo images as fallbacks here.
 * - Uses a neutral placeholder and robust URL normalization for any provided paths.
 */
const StatsPanel = ({ user, onAction = () => {} }) => {
  // Defensive extraction of common fields
  const displayName =
    user?.name || user?.username || user?.displayName || "Unknown";

  // Helper: normalize/absolutize any image-ish value
  // Accepts absolute URLs, /assets/* (served by client), or uploads/relative paths.
  const resolveImg = (val, fallback = PLACEHOLDER_IMAGE) => {
    if (!val || typeof val !== "string") return fallback;
    const s = String(val);
    // Keep absolute URLs and data URLs as-is
    if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;
    // Keep client-served static assets as-is
    if (s.startsWith("/assets/") || s.startsWith("/static/")) return s;
    // Otherwise absolutize against BACKEND_BASE_URL (handles '/uploads' and bare names)
    const abs = absolutizeImage(s);
    return abs || fallback;
  };

  // NOTE:
  // - Replace older '/assets/your-avatar.jpg' with the configured neutral placeholder.
  // - Replace older '/assets/bunny*.jpg' with neutral placeholder; Bunny is demo-only.
  const youPhoto = resolveImg(user?.youPhoto, PLACEHOLDER_IMAGE);

  // Prefer profilePicture, fallback to profilePhoto, and finally to neutral placeholder.
  const profilePhoto = resolveImg(
    user?.profilePicture || user?.profilePhoto,
    PLACEHOLDER_IMAGE
  );

  const compatibility =
    user?.compatibility != null ? Number(user.compatibility) : 0;

  // Support both id shapes
  const userId = user?.id || user?._id || null;

  const handleAction = (id, action) => (e) => {
    e.preventDefault();
    onAction(id, action);
    // Remove focus outline from the clicked element (UX polish)
    e.currentTarget?.blur?.();
  };

  return (
    <div
      className="mt-6"
      style={{
        overflowAnchor: "none", // prevent scroll anchoring shifts
        minHeight: "4.5rem", // stabilize height to avoid layout shift
      }}
    >
      <h4 className="text-gray-700 font-semibold mb-2">You & {displayName}</h4>

      <div className="flex items-center space-x-2 mb-2">
        <img
          src={youPhoto}
          alt="Your avatar"
          className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
          onError={(e) => {
            // Fallback to neutral placeholder on broken src
            if (e.currentTarget.src !== PLACEHOLDER_IMAGE) {
              e.currentTarget.src = PLACEHOLDER_IMAGE;
            }
          }}
        />

        <span className="text-lg font-bold text-[#005FFF]">
          {Number.isFinite(compatibility) ? compatibility : 0}%
        </span>

        <img
          src={profilePhoto}
          alt={`${displayName} avatar`}
          className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
          onError={(e) => {
            if (e.currentTarget.src !== PLACEHOLDER_IMAGE) {
              e.currentTarget.src = PLACEHOLDER_IMAGE;
            }
          }}
        />
      </div>

      <div className="flex items-center space-x-6">
        <div
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.currentTarget.blur()}
          onClick={handleAction(userId, "agree")}
          className="flex items-center space-x-1 cursor-pointer hover:text-[#005FFF] focus:outline-none"
        >
          <span className="font-semibold">Agree 🙂</span>
          <span className="text-gray-500 text-xs">
            ({user?.agreeCount != null ? user.agreeCount : 0})
          </span>
        </div>

        <div
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.currentTarget.blur()}
          onClick={handleAction(userId, "disagree")}
          className="flex items-center space-x-1 cursor-pointer hover:text-gray-700 focus:outline-none"
        >
          <span className="font-semibold">Disagree 😕</span>
          <span className="text-gray-500 text-xs">
            ({user?.disagreeCount != null ? user.disagreeCount : 0})
          </span>
        </div>

        <div
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.currentTarget.blur()}
          onClick={handleAction(userId, "findOut")}
          className="flex items-center space-x-1 cursor-pointer hover:text-[#3B5998] focus:outline-none"
        >
          <span className="font-semibold">Find Out 🔍</span>
          <span className="text-gray-500 text-xs">
            ({user?.findOutCount != null ? user.findOutCount : 0})
          </span>
        </div>
      </div>
    </div>
  );
};

StatsPanel.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    name: PropTypes.string,
    displayName: PropTypes.string,
    compatibility: PropTypes.number,
    youPhoto: PropTypes.string,
    profilePhoto: PropTypes.string,
    profilePicture: PropTypes.string,
    agreeCount: PropTypes.number,
    disagreeCount: PropTypes.number,
    findOutCount: PropTypes.number,
  }).isRequired,
  onAction: PropTypes.func,
};

export default React.memo(StatsPanel);
// --- REPLACE END ---
