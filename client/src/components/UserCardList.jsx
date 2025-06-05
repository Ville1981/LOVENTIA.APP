// src/components/UserCardList.jsx

import React from "react";
import UserCard from "./UserCard";

const UserCardList = ({ users }) => {
  if (!users || users.length === 0) {
    return <p className="text-center text-gray-500 mt-6">🔍 Ei hakutuloksia</p>;
  }

  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      {users.map((user) => (
        <div key={user._id} className="w-full max-w-[800px]">
          <UserCard user={user} />
        </div>
      ))}
    </div>
  );
};

export default UserCardList;
