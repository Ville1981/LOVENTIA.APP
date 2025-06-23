// src/components/discover/ProfileCardList.jsx

import React, { memo, useMemo } from "react";
import PropTypes from "prop-types";
import Slider from "react-slick";
import ProfileCard from "./ProfileCard";

// Näitä importteja tarvitaan, jotta slickin CSS latautuu
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/**
 * Displays a carousel of profile cards (one at a time),
 * or a fallback message if there are no users.
 */
const ProfileCardList = ({ users = [], onAction }) => {
  if (!Array.isArray(users) || users.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">
        🔍 No results found
      </p>
    );
  }

  // Muistetaan asetukset yhdellä kertaa, jotta Slick ei re-initoidu
  const settings = useMemo(() => ({
    dots: false,
    arrows: true,
    infinite: false,
    speed: 300,
    slidesToShow: 1,
    slidesToScroll: 1,
    adaptiveHeight: true,

    // Estetään kaikenlainen fokus- ja hover-triggeröity scrollaus
    accessibility: false,
    focusOnSelect: false,
    focusOnChange: false,
    pauseOnFocus: false,
    pauseOnHover: false,
  }), []);

  return (
    <div className="profile-carousel mt-6 w-full">
      {/* Rajoita karuselli maksimissaan 800px levyiseksi ja keskelle */}
      <div className="mx-auto w-full max-w-[800px]">
        {/* Ei key-proppia, jotta Slider pysyy samana instanssina */}
        <Slider {...settings}>
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
  users: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      _id: PropTypes.string,
    })
  ).isRequired,
  onAction: PropTypes.func.isRequired,
};

export default memo(ProfileCardList);
