import React, { memo } from "react";
import PropTypes from "prop-types";
import ProfileCard from "./ProfileCard";

const ProfileCardList = ({ users = [], onAction }) => {
  // Jos ei ole yhtään käyttäjää, näytetään viesti
  if (!Array.isArray(users) || users.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">
        🔍 Ei hakutuloksia
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      {users.map((u) => {
        // Käytetään normalized id:tä, fallback _id jos id puuttuu
        const key = u.id || u._id;
        const userId = u.id || u._id;
        return (
          <div key={key} className="w-full max-w-[800px]">
            <ProfileCard
              user={u}
              onPass={() => onAction(userId, "pass")}
              onLike={() => onAction(userId, "like")}
              onSuperlike={() => onAction(userId, "superlike")}
            />
          </div>
        );
      })}
    </div>
  );
};

ProfileCardList.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      _id: PropTypes.string,
      // muut kentät eivät ole välttämättömiä listan tarkistukseen
    })
  ),
  onAction: PropTypes.func.isRequired,
};

ProfileCardList.defaultProps = {
  users: [],
};

export default memo(ProfileCardList);
