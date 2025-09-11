// File: client/src/components/discover/ProfileCardList.jsx

// --- REPLACE START: ProfileCardList – stable ids, proper empty state, forced slider reset on data change ---
import PropTypes from "prop-types";
import React, { memo, useMemo, useRef, useEffect } from "react";
import Slider from "react-slick";

import ProfileCard from "./ProfileCard";

// Slick-carousel styles (kept to ensure styles are present regardless of App mounting order)
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/**
 * Displays a carousel of profile cards (one at a time),
 * or a fallback message if there are no users.
 * Notes:
 * - Uses stable keys derived from normalized ids (id | _id)
 * - Forces slider remount on dataset changes to avoid stale active index
 * - Keeps behavior consistent with Discover and other pages
 * - ❗ Fix: maintain hook order even when list becomes empty (no early-return before all hooks run)
 */
const ProfileCardList = ({ users = [], onAction }) => {
  const sliderRef = useRef(null);

  // --- Normalize ids and filter out invalid user entries (defensive) ---
  const normalizeId = (val) => {
    if (val == null) return null;
    try {
      if (typeof val === "object" && typeof val.toString === "function") {
        return val.toString();
      }
      return String(val);
    } catch {
      return null;
    }
  };

  // Build a safe, normalized array that always has string `id`
  const safeUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users
      .filter((u) => u && (u.id != null || u._id != null))
      .map((u) => ({ ...u, id: normalizeId(u.id ?? u._id) }))
      .filter((u) => !!u.id);
  }, [users]);

  // Compute a stable content key: when user set changes, this string changes
  const userKey = safeUsers.map((u) => u.id).join("|");

  // When dataset changes, jump back to the first slide without animation flicker
  useEffect(() => {
    sliderRef.current?.slickGoTo(0, /* dontAnimate */ true);
  }, [userKey]);

  // ❗ IMPORTANT: Define all hooks before any conditional return to keep hook order stable.
  // Slider settings (kept minimal and consistent with project defaults)
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

  // Empty state if no valid users (after hooks so order never changes)
  if (safeUsers.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-6">🔍 No results found</p>
    );
  }

  return (
    <div
      className="profile-carousel mt-6 w-full"
      style={{ overflowAnchor: "none" }}
    >
      <div
        className="mx-auto w-full max-w-[800px]"
        style={{ overflowAnchor: "none" }}
      >
        {/* Key forces full remount when user set changes to reset internal state */}
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
