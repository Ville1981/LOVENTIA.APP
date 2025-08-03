// src/components/discover/ProfileCard.jsx

import React, { memo, useState, useEffect } from "react";
import PropTypes from "prop-types";

import PhotoCarousel from "./PhotoCarousel";
import ActionButtons from "./ActionButtons";
import LocationText from "./LocationText";
import SummaryAccordion from "./SummaryAccordion";
import StatsPanel from "./StatsPanel";
import DetailsSection from "./DetailsSection";

// Static fallback photos from public/assets (relative polut)
const FALLBACK_PHOTOS = [
  "/assets/bunny1.jpg",
  "/assets/bunny2.jpg",
  "/assets/bunny3.jpg",
];

const ProfileCard = ({ user, onPass, onLike, onSuperlike }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper: normalisoi mikä tahansa raw URL absoluteksi
  const normalize = (raw) => {
    if (!raw) return "";
    if (/^https?:\/\//.test(raw)) return raw;
    // Jos alkaa slashilla, lisää origin eteen, muuten lisää myös "/"
    return raw.startsWith("/")
      ? `${window.location.origin}${raw}`
      : `${window.location.origin}/${raw}`;
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      // Otetaan joko backendin kuvat tai fallback
      const rawList =
        Array.isArray(user.photos) && user.photos.length > 0
          ? user.photos
          : FALLBACK_PHOTOS;

      // Muutetaan kaikki itemit string-URLeiksi ja normalisoidaan
      const urls = rawList
        .map((item) => {
          if (typeof item === "string") return item;
          if (item.url) return item.url;
          if (item.src) return item.src;
          if (item.photoUrl) return item.photoUrl;
          if (item.imageUrl) return item.imageUrl;
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
  }, [user.photos]);

  const displayName = user.name || user.username || "Unknown";
  const id = user.id || user._id;

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading profile…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div
      className="relative bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden w-full"
    >
      {/* Karuselli: korkeus on rajoitettu PhotoCarousel-komponentissa */}
      <PhotoCarousel photos={photos} />

      {/* INTRO-painike */}
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
        {/* Nimi, ikä ja match-prosentti */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">
            {displayName}, {user.age ?? "?"}
          </h3>
          <div className="w-10 h-10 border-2 border-blue-600 rounded-full flex items-center justify-center text-blue-600 font-bold">
            {user.compatibility ?? 0}%
          </div>
        </div>

        {/* Sijainti */}
        <LocationText
          city={user.city}
          region={user.region}
          country={user.country}
        />

        {/* Pass / Like / Superlike -napit */}
        <ActionButtons
          userId={id}
          onPass={() => onPass(id)}
          onLike={() => onLike(id)}
          onSuperlike={() => onSuperlike(id)}
        />

        {/* Kuvailu */}
        <SummaryAccordion summary={user.summary} />

        {/* Statistikot */}
        <StatsPanel user={user} />

        {/* Lisätiedot */}
        <DetailsSection details={user.details} />
      </div>
    </div>
  );
};

ProfileCard.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string,
    id: PropTypes.string,
    username: PropTypes.string,
    name: PropTypes.string,
    age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    compatibility: PropTypes.number,
    city: PropTypes.string,
    region: PropTypes.string,
    country: PropTypes.string,
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
