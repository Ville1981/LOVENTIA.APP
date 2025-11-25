// File: client/src/components/WhoLikedMeCard.jsx
// --- NEW FILE START: reusable card for "Who liked me" grid ---
import React from "react";
import { useNavigate } from "react-router-dom";

/**
 * Small pill badge for Premium users.
 */
function PremiumBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-900">
      Premium
    </span>
  );
}

/**
 * Card component used in the "Who liked you" grid.
 *
 * Props:
 * - targetId: string (user id to open chat with)
 * - imageSrc: string (already resolved image URL)
 * - title: string (username / display name)
 * - email: string (optional, shown below title)
 * - isPremium: boolean (if true, show Premium badge)
 */
const WhoLikedMeCard = ({
  targetId,
  imageSrc,
  title,
  email,
  isPremium,
}) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (!targetId) return;
    navigate(`/chat/${targetId}`);
  };

  const handleCardKeyDown = (event) => {
    if (!targetId) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(`/chat/${targetId}`);
    }
  };

  const safeTitle = title || "Anonymous";

  return (
    <div
      className="bg-white p-4 rounded shadow-md text-center cursor-pointer hover:shadow-lg transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      aria-label={`Open chat with ${safeTitle}`}
    >
      <img
        src={imageSrc}
        alt={safeTitle}
        className="w-full h-48 object-cover rounded mb-3"
        loading="lazy"
      />
      <h3 className="text-lg font-bold flex items-center justify-center gap-1">
        <span>{safeTitle}</span>
        {isPremium && <PremiumBadge />}
      </h3>
      {email && <p className="text-sm text-gray-600">{email}</p>}
    </div>
  );
};

export default WhoLikedMeCard;
// --- NEW FILE END ---
