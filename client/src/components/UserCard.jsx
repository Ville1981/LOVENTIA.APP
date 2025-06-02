import React from "react";
import UserCard from "./UserCard";


const UserCardList = ({ users }) => {
  if (!users || users.length === 0) {
    return <p className="text-center text-gray-500 mt-6">🔍 Ei hakutuloksia</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
      {users.map((user) => (
        <UserCard key={user._id} user={user} />
      ))}
    </div>
  );
};

export default UserCardList;
