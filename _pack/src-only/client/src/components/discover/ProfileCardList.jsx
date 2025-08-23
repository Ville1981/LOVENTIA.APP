// --- REPLACE START: ProfileCardList – stable ids, proper empty state, forced slider reset on data change ---
import PropTypes from "prop-types";
import React, { memo, useMemo, useRef, useEffect } from "react";
import Slider from "react-slick";

import ProfileCard from "./ProfileCard";

// Slick-carousel styles (kept to ensure styles are present regardless of App.jsx)
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/**
 * Displays a carousel of profile cards (one at a time),
 * or a fallback message if there are no users.
 */
const ProfileCardList = ({ users = [], onAction }) => {
  // --- REPLACE START: normalize users & stable ids; only show "no results" if truly empty ---
  const normalizeId = (val) => {
    if (val == null) return null;
    try {
      // Handle ObjectId-like objects
      if (typeof val === "object" && typeof val.toString === "function") {
        return val.toString();
      }
      return String(val);
    } catch {
      return null;
    }
  };

  const safeUsers = Array.isArray(users)
    ? users
        .filter((u) => u && (u.id != null || u._id != null))
        .map((u) => ({ ...u, id: normalizeId(u.id ?? u._id) }))
    : [];

  if (safeUsers.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">🔍 No results found</p>
    );
  }
  // --- REPLACE END ---

  const sliderRef = useRef(null);

  // --- REPLACE START: compute stable key from normalized ids and force slider remount on change ---
  const userKey = safeUsers.map((u) => u.id).join("|");
  // --- REPLACE END ---

  useEffect(() => {
    // Jump to first slide when the dataset changes to avoid stale index
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
        {/* --- REPLACE START: add key to Slider so it fully resets when user set changes --- */}
        <Slider
          key={userKey}
          ref={sliderRef}
          {...settings}
          style={{ overflowAnchor: "none", minHeight: "600px" }}
        >
          {safeUsers.map((u) => {
            const userId = u.id;
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
        {/* --- REPLACE END --- */}
      </div>
    </div>
  );
};

ProfileCardList.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  onAction: PropTypes.func.isRequired,
};

export default memo(ProfileCardList);
// --- REPLACE END ---

