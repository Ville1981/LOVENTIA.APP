// PATH: client/src/components/discover/ProfileCard.jsx

// --- REPLACE START: ProfileCard – normalize location (string → object), robust image URLs, remove bad ESLint directive ---
import PropTypes from "prop-types";
import React, { memo, useEffect, useMemo, useState } from "react";

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
    const s0 = raw.trim();
    if (s0 === "") return "";

    // Absolute URL already
    if (/^https?:\/\//i.test(s0)) return s0;

    // Client-side static assets (keep relative to client origin)
    if (s0.startsWith("/assets/")) return `${window.location.origin}${s0}`;

    // Server-side uploaded images
    if (s0.startsWith("/uploads/")) return `${BACKEND_BASE_URL}${s0}`;

    // Bare filename that likely refers to an upload
    if (!s0.startsWith("/")) return `${BACKEND_BASE_URL}/uploads/${s0}`;

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

  // --- Normalize location (Option A): if string, coerce to object for safe consumers ---
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
            {displayName}, {user?.age ?? "?"}
          </h3>
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
        />

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
  }).isRequired,
  onPass: PropTypes.func.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperlike: PropTypes.func.isRequired,
};

export default memo(ProfileCard);
// --- REPLACE END ---

