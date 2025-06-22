import React, { memo } from "react";
import PropTypes from "prop-types";
import Slider from "react-slick";
import ProfileCard from "./ProfileCard";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const ProfileCardList = ({ users = [], onAction }) => {
  if (!Array.isArray(users) || users.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">
        🔍 No results found
      </p>
    );
  }

  const settings = {
    dots: false,
    arrows: true,
    infinite: false,
    speed: 300,
    slidesToShow: 1,
    slidesToScroll: 1,
    adaptiveHeight: true,
  };

  const firstUserId = users[0].id || users[0]._id;

  return (
    <div className="profile-carousel mt-6 w-full">
      {/* rajoita karuselli 800px leveäksi ja keskelle */}
      <div className="mx-auto w-full max-w-[800px]">
        <Slider key={firstUserId} {...settings}>
          {users.map((u) => {
            const userId = u.id || u._id;
            return (
              <div key={userId} className="px-2">
                <ProfileCard
                  user={u}
                  onPass={() => onAction(userId, "pass")}
                  onLike={() => onAction(userId, "like")}
                  onSuperlike={() => onAction(userId, "superlike")}
                />
              </div>
            );
          })}
        </Slider>
      </div>
    </div>
  );
};

ProfileCardList.propTypes = {
  users: PropTypes.array.isRequired,
  onAction: PropTypes.func.isRequired,
};

export default memo(ProfileCardList);
