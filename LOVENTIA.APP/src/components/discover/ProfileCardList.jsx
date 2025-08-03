// src/components/discover/ProfileCardList.jsx

import PropTypes from "prop-types";
import React, { memo, useMemo, useRef, useEffect } from "react";
import Slider from "react-slick";

import ProfileCard from "./ProfileCard";

// Slick-carouselin tyylit (pidetään App.jsx:ssä myös, mutta varmistetaan)
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/**
 * Displays a carousel of profile cards (one at a time),
 * or a fallback message if there are no users.
 */
const ProfileCardList = ({ users = [], onAction }) => {
  if (!Array.isArray(users) || users.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">🔍 No results found</p>
    );
  }

  const sliderRef = useRef(null);
  const userKey = users.map((u) => u.id || u._id).join("|");

  useEffect(() => {
    sliderRef.current?.slickGoTo(0, /* dontAnimate */ true);
  }, [userKey]);

  const settings = useMemo(
    () => ({
      initialSlide: 0,
      dots: false,
      arrows: true,
      infinite: false,
      speed: 300,
      slidesToShow: 1,
      slidesToScroll: 1,
      adaptiveHeight: false,

      accessibility: false,
      focusOnSelect: false,
      focusOnChange: false,
      pauseOnFocus: false,
      pauseOnHover: false,
    }),
    []
  );

  return (
    <div
      className="profile-carousel mt-6 w-full"
      style={{ overflowAnchor: "none" }}
    >
      <div
        className="mx-auto w-full max-w-[800px]"
        style={{ overflowAnchor: "none" }}
      >
        <Slider
          ref={sliderRef}
          {...settings}
          style={{ overflowAnchor: "none", minHeight: "600px" }}
        >
          {users.map((u) => {
            const userId = u.id || u._id;
            return (
              <div
                key={userId}
                className="px-2"
                tabIndex={-1}
                style={{ minHeight: "100%", overflowAnchor: "none" }}
              >
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
