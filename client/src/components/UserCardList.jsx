// src/components/UserCardList.jsx

import React, { memo } from "react";
import PropTypes from "prop-types";
import UserCard from "./UserCard";
import { BACKEND_BASE_URL } from "../utils/config";

/**
 * UserCardList: displays a vertical list of UserCard components.
 * Props:
 *  - users: array of user objects, each must include _id, photos (array of { url })
 *  - onAction: callback function for swipe actions
 */
const UserCardList = ({ users, onAction }) => {
  if (!users || users.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">
        🔍 No results found
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      {users.map((user) => (
        <div key={user._id} className="w-full max-w-[800px]">
          {/* Pass prefixed image URLs into UserCard */}
          <UserCard
            user={{
              ...user,
              photos: user.photos.map((p) => ({
                ...p,
                // --- REPLACE START: prefix backend URL for carousel images
                url: `${BACKEND_BASE_URL || ""}${p.url}`,
                // --- REPLACE END
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
