import React, { memo, useState, useEffect } from "react";
import PropTypes from "prop-types";

import PhotoCarousel from "./PhotoCarousel";
import ActionButtons from "./ActionButtons";
import LocationText from "./LocationText";
import SummaryAccordion from "./SummaryAccordion";
import StatsPanel from "./StatsPanel";
import DetailsSection from "./DetailsSection";

// Staattiset fallback-kuvat public/assets-kansiosta
const FALLBACK_PHOTOS = [
  "/assets/bunny1.jpg",
  "/assets/bunny2.jpg",
  "/assets/bunny3.jpg"
];

const ProfileCard = ({ user, onPass, onLike, onSuperlike }) => {
  const [photos, setPhotos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Kun user.photos muuttuu, päivitä karuselli
  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      const list = Array.isArray(user.photos) && user.photos.length > 0
        ? user.photos
        : FALLBACK_PHOTOS;
      setPhotos(list);
    } catch (e) {
      setError("Kuvien lataus epäonnistui");
    } finally {
      setLoading(false);
    }
  }, [user.photos]);

  // Display name ja id-fallback (jos normalization jäi tekemättä)
  const displayName = user.name || user.username || "Unknown";
  const id          = user.id   || user._id;

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Ladataan profiilia…
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
    <div className="relative bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
      <PhotoCarousel photos={photos} />

      {/* INTRO-painike (optional) */}
      <button
        type="button"
        className="absolute bottom-2 right-2 bg-white text-[#005FFF] text-xs font-semibold py-1 px-2 rounded shadow-sm"
      >
        INTRO
      </button>

      <div className="p-4 space-y-4">
        {/* Nimi, ikä ja match-% */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">
            {displayName}, {user.age ?? "?"}
          </h3>
          <div className="w-10 h-10 border-2 border-[#005FFF] rounded-full flex items-center justify-center text-[#005FFF] font-bold">
            {user.compatibility ?? 0}%
          </div>
        </div>

        {/* Sijainti */}
        <LocationText
          city={user.city}
          region={user.region}
          country={user.country}
        />

        {/* Pass/Like/Superlike */}
        <ActionButtons
          userId={id}
          onPass={() => onPass(id)}
          onLike={() => onLike(id)}
          onSuperlike={() => onSuperlike(id)}
        />

        {/* My self-summary */}
        <SummaryAccordion summary={user.summary} />

        {/* You & [Profiili] -statistiikat */}
        <StatsPanel user={user} />

        {/* Details-paneeli */}
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
    photos: PropTypes.arrayOf(PropTypes.string),
    summary: PropTypes.string,
    details: PropTypes.object,
  }).isRequired,
  onPass: PropTypes.func.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperlike: PropTypes.func.isRequired,
};

export default memo(ProfileCard);
