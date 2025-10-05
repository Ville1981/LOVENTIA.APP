// PATH: client/src/components/UserCardList.jsx

import PropTypes from "prop-types";
import React, { memo } from "react";

import UserCard from "./UserCard";
import { BACKEND_BASE_URL } from "../utils/config";

// --- REPLACE START: safely prefix backend only for relative URLs ---
/**
 * Resolve an image URL:
 * - Leaves absolute http(s) URLs untouched.
 * - Normalizes relative paths to start with a single '/' and prefixes BACKEND_BASE_URL.
 */
function resolveImgUrl(input) {
  const src = typeof input === "string" ? input : input?.url || "";
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src; // already absolute
  const norm = src.startsWith("/") ? src : `/${src}`;
  return `${BACKEND_BASE_URL}${norm}`;
}
// --- REPLACE END ---

/**
 * UserCardList: displays a vertical list of UserCard components.
 * Props:
 *  - users: array of user objects, each must include _id, photos (array of { url })
 *  - onAction: callback function for swipe actions
 */
const UserCardList = ({ users, onAction }) => {
  if (!users || users.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">🔍 No results found</p>
    );
  }

  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      {users.map((user) => (
        <div key={user._id} className="w-full max-w-[800px]">
          {/* Pass image URLs into UserCard (prefix backend only when needed) */}
          <UserCard
            user={{
              ...user,
              photos: (user.photos || []).map((p) => ({
                ...p,
                // --- REPLACE START: prefix only relative URLs; keep absolute as-is
                url: resolveImgUrl(p),
                // --- REPLACE END ---
              })),
            }}
            onAction={onAction}
          />
        </div>
      ))}
    </div>
  );
};

UserCardList.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      photos: PropTypes.arrayOf(
        PropTypes.shape({ url: PropTypes.string.isRequired })
      ),
    })
  ).isRequired,
  onAction: PropTypes.func.isRequired,
};

export default memo(UserCardList);
