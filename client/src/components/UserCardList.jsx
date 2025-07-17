// src/components/UserCardList.jsx

import React, { memo } from "react";
import PropTypes from "prop-types";
import UserCard from "./UserCard";

const UserCardList = ({ users, onAction }) => {
  if (!users || users.length === 0) {
    return <p className="text-center text-gray-500 mt-6">🔍 Ei hakutuloksia</p>;
  }

  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      {users.map((user) => (
        <div key={user._id} className="w-full max-w-[800px]">
          <UserCard user={user} onAction={onAction} />
        </div>
      ))}
    </div>
  );
};

UserCardList.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      // muut kentät eivät ole välttämättömiä listan tarkistukseen
    })
  ).isRequired,
  onAction: PropTypes.func.isRequired,
};

export default memo(UserCardList);
