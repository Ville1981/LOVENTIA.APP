// --- REPLACE START: ProfileCardList – stable ids + inline ad slots every N items (minimal changes) ---
import PropTypes from "prop-types";
import React, { memo, useMemo, useRef, useEffect } from "react";
import Slider from "react-slick";

import ProfileCard from "./ProfileCard";
import InlineAdSlot from "../InlineAdSlot"; // ← inline ad (self-gated via AdGate)

// Slick-carousel styles (kept to ensure styles are present regardless of App mounting order)
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/**
 * Displays a carousel of profile cards (one at a time),
 * optionally inserting inline ad slots every N items.
 *
 * Notes:
 * - Uses stable keys derived from normalized ids (id | _id)
 * - Forces slider remount on dataset changes to avoid stale active index
 * - Hook order remains stable (no early return before hooks)
 * - Inline ads are rendered via <InlineAdSlot/> which wraps its own <AdGate type="inline" />
 *   so business rules (consent/premium/freq-cap/flags) are centralized.
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

  // --- Inline ad cadence ---
  // Allow override via env; default every 6 items (i.e., after 5th, 11th, …)
  const INLINE_EVERY = Math.max(
    0,
    Number.parseInt(import.meta.env.VITE_ADS_INLINE_EVERY || "6", 10)
  );

  // Build an interleaved array of slides: user cards + (optional) inline ad slots.
  // Keep keys stable and distinct to avoid React reconciliation issues.
  const slides = useMemo(() => {
    if (!safeUsers.length) return [];

    const out = [];
    for (let i = 0; i < safeUsers.length; i += 1) {
      const u = safeUsers[i];
      out.push({
        kind: "profile",
        key: `u-${u.id}`,
        user: u,
      });

      if (INLINE_EVERY > 0) {
        const isBoundary = (i + 1) % INLINE_EVERY === 0 && i !== safeUsers.length - 1;
        if (isBoundary) {
          const adIndex = (i + 1) / INLINE_EVERY;
          out.push({
            kind: "ad",
            key: `ad-slot-${adIndex}`,
          });
        }
      }
    }
    return out;
  }, [safeUsers, INLINE_EVERY]);

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
          {slides.map((item) => {
            if (item.kind === "ad") {
              return (
                <div
                  key={item.key}
                  className="px-2"
                  tabIndex={-1}
                  style={{ minHeight: "100%", overflowAnchor: "none" }}
                >
                  {/* Default creative; can be customized via props later */}
                  <InlineAdSlot className="max-w-[720px] mx-auto" />
                </div>
              );
            }

            const u = item.user;
            return (
              <div
                key={item.key}
                className="px-2"
                tabIndex={-1}
                style={{ minHeight: "100%", overflowAnchor: "none" }}
              >
                <ProfileCard
                  user={u}
                  onPass={() => onAction(u.id, "pass")}
                  onLike={() => onAction(u.id, "like")}
                  onSuperlike={() => onAction(u.id, "superlike")}
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





