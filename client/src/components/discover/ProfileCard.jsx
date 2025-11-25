// PATH: client/src/components/discover/ProfileCard.jsx

// --- REPLACE START: ProfileCard – normalize location (string → object), robust image URLs,
// add RewindButton (premium-gated), likes quota passthrough, and Premium badge support ---
import PropTypes from "prop-types";
import React, { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ActionButtons from "./ActionButtons";
import DetailsSection from "./DetailsSection";
import LocationText from "./LocationText";
import PhotoCarousel from "./PhotoCarousel";
import StatsPanel from "./StatsPanel";
import SummaryAccordion from "./SummaryAccordion";
import { BACKEND_BASE_URL } from "../../utils/config";
import RewindButton from "../RewindButton"; // Premium-gated rewind button

// Demo-only fallback photos (used when user.photos is empty).
// Bunny images are only used for demo/prototype purposes.
const DEMO_FALLBACK_PHOTOS = [
  "/assets/bunny1.jpg",
  "/assets/bunny2.jpg",
  "/assets/bunny3.jpg",
];

const ProfileCard = ({
  user,
  onPass,
  onLike,
  onSuperlike,
  // (NEW) Optional likes quota data for free users
  likesLimitPerDay,
  likesRemainingToday,
}) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  /**
   * Normalize any raw image reference into a fully resolvable URL.
   * Rules:
   *  - Absolute http(s) → return as-is
   *  - /uploads/... or bare filename → prefix with BACKEND_BASE_URL
   *  - /assets/... → keep relative (served by client)
   *  - Any other leading-slash path → prefix with window.location.origin
   */
  const normalize = (raw) => {
    if (!raw || typeof raw !== "string") return "";
    const s0 = raw.trim();
    if (s0 === "") return "";

    // Absolute URL already
    if (/^https?:\/\//i.test(s0)) return s0;

    // Client-side static assets (keep relative to client origin)
    if (s0.startsWith("/assets/")) {
      return `${window.location.origin}${s0}`;
    }

    // Server-side uploaded images
    if (s0.startsWith("/uploads/")) {
      return `${BACKEND_BASE_URL}${s0}`;
    }

    // Bare filename that likely refers to an upload
    if (!s0.startsWith("/")) {
      return `${BACKEND_BASE_URL}/uploads/${s0}`;
    }

    // Any other rooted path (rare): assume client origin
    return `${window.location.origin}${s0}`;
  };

  // Normalize photos from various shapes to URL strings
  const photoUrls = useMemo(() => {
    const rawList =
      Array.isArray(user?.photos) && user.photos.length > 0
        ? user.photos
        : DEMO_FALLBACK_PHOTOS;

    return rawList
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.url) return item.url;
        if (item?.src) return item.src;
        if (item?.photoUrl) return item.photoUrl;
        if (item?.imageUrl) return item.imageUrl;
        return "";
      })
      .map(normalize)
      .filter(Boolean);
  }, [user?.photos]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      setPhotos(photoUrls);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setError("Failed to load images");
    } finally {
      setLoading(false);
    }
  }, [photoUrls]);

  // Safe display name and id normalization
  const displayName = user?.name || user?.username || "Unknown";
  const id = (user?.id || user?._id || "").toString();

  // Normalize location: accept both string and object, coerce to a uniform object
  const normalizedLocation = useMemo(() => {
    const raw = user?.location;
    if (!raw) {
      return {
        city: user?.city || "",
        region: user?.region || "",
        country: user?.country || "",
        label: "",
      };
    }
    if (typeof raw === "string") {
      // Keep original city/region/country fields as hints; label preserves raw text
      return {
        city: user?.city || "",
        region: user?.region || "",
        country: user?.country || "",
        label: raw,
      };
    }
    // Assume object-like
    return {
      city: raw.city ?? user?.city ?? "",
      region: raw.region ?? user?.region ?? "",
      country: raw.country ?? user?.country ?? "",
      label: raw.label ?? "",
    };
  }, [user?.location, user?.city, user?.region, user?.country]);

  /**
   * Determine if this particular profile should display a Premium badge.
   * We support several shapes:
   *  - user.isPremiumUser (pre-normalized by Discover)
   *  - user.premium / user.isPremium
   *  - user.entitlements.tier === "premium"
   */
  const isPremiumUser = useMemo(() => {
    if (!user) return false;
    if (user.isPremiumUser === true) return true;
    if (user.premium === true || user.isPremium === true) return true;
    const tier = user.entitlements?.tier;
    return tier === "premium";
  }, [user]);

  // INTRO click handler: navigate to ChatPage (intro-gate is handled there)
  const handleIntroClick = () => {
    if (!id) return;
    navigate(`/chat/${id}`, { state: { viaIntro: true } });
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading profile…</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="relative bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden w-full">
      {/* Photo carousel */}
      <PhotoCarousel photos={photos} />

      {/* INTRO button */}
      <button
        type="button"
        className="absolute bottom-2 right-2 bg-white text-blue-600 text-xs font-semibold py-1 px-2 rounded shadow-sm"
        onClick={handleIntroClick}
      >
        INTRO
      </button>

      <div className="p-4 space-y-4">
        {/* Name, age, compatibility, premium badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold">
              {displayName}, {user?.age ?? "?"}
            </h3>
            {isPremiumUser && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-400 text-yellow-900 border border-yellow-500">
                Premium
              </span>
            )}
          </div>
          <div className="w-10 h-10 border-2 border-blue-600 rounded-full flex items-center justify-center text-blue-600 font-bold">
            {user?.compatibility ?? 0}%
          </div>
        </div>

        {/* Location */}
        <LocationText
          city={normalizedLocation.city}
          region={normalizedLocation.region}
          country={normalizedLocation.country}
        />

        {/* Pass / Like / Superlike buttons */}
        <ActionButtons
          userId={id}
          onPass={() => onPass(id)}
          onLike={() => onLike(id)}
          onSuperlike={() => onSuperlike(id)}
          // (NEW) Likes quota data for free users; if undefined, quota label stays hidden
          likesLimitPerDay={likesLimitPerDay}
          likesRemainingToday={likesRemainingToday}
        />

        {/* Rewind control (premium-gated via internal FeatureGate in the component) */}
        <div className="flex justify-end">
          <RewindButton compact className="mt-2" />
        </div>

        {/* Summary */}
        <SummaryAccordion summary={user?.summary} />

        {/* Stats */}
        <StatsPanel user={user} />

        {/* Details */}
        <DetailsSection details={user?.details} />
      </div>
    </div>
  );
};

ProfileCard.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    name: PropTypes.string,
    age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    compatibility: PropTypes.number,
    city: PropTypes.string,
    region: PropTypes.string,
    country: PropTypes.string,
    // Accept both object and string to avoid PropTypes warning until all callers normalize upstream.
    location: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        city: PropTypes.string,
        region: PropTypes.string,
        country: PropTypes.string,
        label: PropTypes.string,
      }),
    ]),
    photos: PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({
          url: PropTypes.string,
          src: PropTypes.string,
          photoUrl: PropTypes.string,
          imageUrl: PropTypes.string,
        }),
      ])
    ),
    summary: PropTypes.string,
    details: PropTypes.object,
    // Premium flags (optional, used for badge)
    isPremiumUser: PropTypes.bool,
    premium: PropTypes.bool,
    isPremium: PropTypes.bool,
    entitlements: PropTypes.shape({
      tier: PropTypes.string,
    }),
  }).isRequired,
  onPass: PropTypes.func.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperlike: PropTypes.func.isRequired,
  // (NEW) Optional likes quota data from parent (used to show "X / Y likes today")
  likesLimitPerDay: PropTypes.number,
  likesRemainingToday: PropTypes.number,
};

export default memo(ProfileCard);
// --- REPLACE END ---


