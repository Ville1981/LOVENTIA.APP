// File: client/src/components/discover/ProfileCard.jsx

// --- REPLACE START: ProfileCard – robust image URL normalization (BACKEND_BASE_URL), safe id/location, minimal changes ---
import PropTypes from "prop-types";
import React, { memo, useState, useEffect } from "react";

import ActionButtons from "./ActionButtons";
import DetailsSection from "./DetailsSection";
import LocationText from "./LocationText";
import PhotoCarousel from "./PhotoCarousel";
import StatsPanel from "./StatsPanel";
import SummaryAccordion from "./SummaryAccordion";
import { BACKEND_BASE_URL } from "../../utils/config";

// Demo-only fallback photos (used when user.photos is empty). 
// Bunny images are only used for demo/prototype purposes.
const DEMO_FALLBACK_PHOTOS = [
  "/assets/bunny1.jpg",
  "/assets/bunny2.jpg",
  "/assets/bunny3.jpg",
];

const ProfileCard = ({ user, onPass, onLike, onSuperlike }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Helper: normalize any raw image reference into a fully resolvable URL.
   * Rules:
   *  - Absolute http(s) → return as-is
   *  - /uploads/... or bare filename → prefix with BACKEND_BASE_URL
   *  - /assets/... → keep relative (served by client)
   *  - Any other leading-slash path → prefix with window.location.origin
   */
  const normalize = (raw) => {
    if (!raw || typeof raw !== "string") return "";
    const s = raw.trim();
    if (s === "") return "";

    // Absolute URL already
    if (/^https?:\/\//i.test(s)) return s;

    // Server-side uploaded images
    if (s.startsWith("/uploads/")) return `${BACKEND_BASE_URL}${s}`;
    // Bare filename that likely refers to an upload
    if (!s.startsWith("/")) return `${BACKEND_BASE_URL}/uploads/${s}`;

    // Client-side static assets (keep relative to client origin)
    if (s.startsWith("/assets/")) return `${window.location.origin}${s}`;

    // Any other rooted path (rare): assume client origin
    return `${window.location.origin}${s}`;
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      // Prefer backend-provided photos, otherwise fall back to demo set
      const rawList =
        Array.isArray(user.photos) && user.photos.length > 0
          ? user.photos
          : DEMO_FALLBACK_PHOTOS;

      const urls = rawList
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

      setPhotos(urls);
    } catch (e) {
      console.error(e);
      setError("Failed to load images");
    } finally {
      setLoading(false);
    }
    // React only when user.photos changes
  }, [user.photos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safe display name and id normalization
  const displayName = user.name || user.username || "Unknown";
  const id = (user.id || user._id || "").toString();

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">Loading profile…</div>
    );
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
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onMouseUp={(e) => e.currentTarget.blur()}
      >
        INTRO
      </button>

      <div className="p-4 space-y-4">
        {/* Name, age, compatibility */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">
            {displayName}, {user.age ?? "?"}
          </h3>
          <div className="w-10 h-10 border-2 border-blue-600 rounded-full flex items-center justify-center text-blue-600 font-bold">
            {user.compatibility ?? 0}%
          </div>
        </div>

        {/* Location */}
        <LocationText
          city={user?.location?.city ?? user.city}
          region={user?.location?.region ?? user.region}
          country={user?.location?.country ?? user.country}
        />

        {/* Pass / Like / Superlike buttons */}
        <ActionButtons
          userId={id}
          onPass={() => onPass(id)}
          onLike={() => onLike(id)}
          onSuperlike={() => onSuperlike(id)}
        />

        {/* Summary */}
        <SummaryAccordion summary={user.summary} />

        {/* Stats */}
        <StatsPanel user={user} />

        {/* Details */}
        <DetailsSection details={user.details} />
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
    location: PropTypes.shape({
      city: PropTypes.string,
      region: PropTypes.string,
      country: PropTypes.string,
    }),
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
  }).isRequired,
  onPass: PropTypes.func.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperlike: PropTypes.func.isRequired,
};

export default memo(ProfileCard);
// --- REPLACE END ---
