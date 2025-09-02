// File: client/src/components/UserCard.jsx

// --- REPLACE START: normalize image paths, accept _id, keep structure & fallbacks ---
import PropTypes from "prop-types";
import React, { useState, memo } from "react";

/**
 * Convert any file path to a web-friendly path:
 * - Replace Windows backslashes with forward slashes
 */
function toWebPath(p) {
  return (p || "").replace(/\\/g, "/");
}

/**
 * Build absolute URL to backend for relative assets.
 * - Respects Vite env `VITE_BACKEND_ORIGIN` if present
 * - Otherwise swaps dev ports 5173/5174 → 5000
 */
function toAbsolute(src) {
  if (!src || typeof src !== "string") return "";
  const normalized = toWebPath(src);
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const origin =
    (import.meta.env && import.meta.env.VITE_BACKEND_ORIGIN) ||
    (typeof window !== "undefined"
      ? window.location.origin.replace(/:(5173|5174)$/, ":5000")
      : "");
  const cleanRel = normalized.replace(/^\/+/, ""); // ensure exactly one slash when joining
  return `${origin}/${cleanRel}`;
}

const UserCard = ({ user, onAction }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use name if available; otherwise fallback to username → "Unknown"
  const displayName = user?.name || user?.username || "Unknown";

  // Source photos from user.extraImages preferred, fallback to user.photos, then three defaults.
  // Accept both strings and { url } items; normalize and de-duplicate while preserving order; keep at most 3.
  const rawPreferredList =
    (Array.isArray(user?.extraImages) && user.extraImages.length > 0
      ? user.extraImages
      : Array.isArray(user?.photos) && user.photos.length > 0
      ? user.photos
      : ["/uploads/bunny1.jpg", "/uploads/bunny2.jpg", "/uploads/bunny3.jpg"]) || [];

  const normalizedPreferred = rawPreferredList
    .map((p) => (typeof p === "string" ? p : p?.url || "")) // <-- handle both shapes
    .filter(Boolean);

  const photos = Array.from(
    new Set(normalizedPreferred.map((p) => toAbsolute(p)).filter(Boolean))
  ).slice(0, 3);

  // Profile avatar fallbacks (accept both 'profilePicture' and 'profilePhoto')
  const profilePhoto = toAbsolute(
    user?.profilePicture || user?.profilePhoto || "/uploads/bunny1.jpg"
  );
  const youPhoto = toAbsolute(user?.youPhoto || "/uploads/bunny2.jpg");

  // Numeric/text fallbacks
  const compatibility =
    user?.compatibility != null ? Number(user.compatibility) : 0;
  const age = user?.age != null ? user.age : "?";

  // Location line "City, Region, Country"
  const location =
    `${user?.city || ""}${user?.region ? ", " + user.region : ""}${
      user?.country ? ", " + user.country : ""
    }`.replace(/^, /, "") || "Unknown location";

  // Unified id for actions (accept both id and _id)
  const uid = user?.id || user?._id || "";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
      {/* --- Three-image strip (responsive) --- */}
      <div className="relative">
        <div className="grid grid-cols-3 gap-1">
          {photos.slice(0, 3).map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`${displayName} photo ${idx + 1}`}
              className="w-full h-32 object-cover rounded-t-lg"
              loading="lazy"
            />
          ))}
        </div>
        {/* INTRO button (non-functional placeholder for now) */}
        <button
          type="button"
          className="absolute bottom-2 right-2 bg-white text-[#005FFF] text-xs font-semibold py-1 px-2 rounded shadow-sm"
        >
          INTRO
        </button>
      </div>

      {/* --- Card body --- */}
      <div className="p-4 space-y-4">
        {/* Name, Age, Compatibility */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">
            {displayName}, {age}
          </h3>
          <div className="w-10 h-10 border-2 border-[#005FFF] rounded-full flex items-center justify-center text-[#005FFF] font-bold">
            {compatibility}%
          </div>
        </div>

        {/* Location */}
        <p className="text-gray-500">{location}</p>

        {/* Actions: Pass / Like / Superlike */}
        <div className="mt-4 flex items-center justify-between space-x-2">
          <button
            type="button"
            className="flex-1 border-2 border-black text-black py-2 rounded-full hover:bg-gray-100 transition duration-150"
            onClick={() => onAction(uid, "pass")}
            disabled={!uid}
          >
            ❌ Pass
          </button>
          <button
            type="button"
            className="flex-1 bg-[#FF4081] text-white py-2 rounded-full hover:opacity-90 transition duration-150"
            onClick={() => onAction(uid, "like")}
            disabled={!uid}
          >
            ❤️ Like
          </button>
          <button
            type="button"
            className="flex-1 bg-[#005FFF] text-white py-2 rounded-full hover:opacity-90 transition duration-150 flex items-center justify-center space-x-1"
            onClick={() => onAction(uid, "superlike")}
            disabled={!uid}
          >
            <span>⭐</span>
            <span>Superlike</span>
          </button>
        </div>

        {/* Self-summary (expand/collapse) */}
        <div className="mt-6">
          <div className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold">
            My self-summary
          </div>
          <div className="border border-gray-200 border-t-0 rounded-b-lg p-2">
            <p
              className={`text-gray-800 text-sm ${
                !isExpanded ? "line-clamp-2" : ""
              }`}
            >
              {user?.summary || "—"}
            </p>
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="text-[#005FFF] text-xs font-medium mt-1"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {/* You & Profile header mini row */}
        <div className="mt-6">
          <h4 className="text-gray-700 font-semibold mb-2">
            You & {displayName}
          </h4>
          <div className="flex items-center space-x-2 mb-2">
            <img
              src={youPhoto}
              alt="Your avatar"
              className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
              loading="lazy"
            />
            <span className="text-lg font-bold text-[#005FFF]">
              {compatibility}%
            </span>
            <img
              src={profilePhoto}
              alt={`${displayName} avatar`}
              className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
              loading="lazy"
            />
          </div>
          <div className="flex items-center space-x-6">
            <button
              type="button"
              className="flex items-center space-x-1 hover:text-[#005FFF]"
              onClick={() => onAction(uid, "agree")}
              disabled={!uid}
              title="Agree"
            >
              <span className="font-semibold">Agree 😊</span>
              <span className="text-gray-500 text-xs">
                ({user?.agreeCount != null ? user.agreeCount : 0})
              </span>
            </button>
            <button
              type="button"
              className="flex items-center space-x-1 hover:text-gray-700"
              onClick={() => onAction(uid, "disagree")}
              disabled={!uid}
              title="Disagree"
            >
              <span className="font-semibold">Disagree 😕</span>
              <span className="text-gray-500 text-xs">
                ({user?.disagreeCount != null ? user.disagreeCount : 0})
              </span>
            </button>
            <button
              type="button"
              className="flex items-center space-x-1 hover:text-[#3B5998]"
              onClick={() => onAction(uid, "findOut")}
              disabled={!uid}
              title="Find Out"
            >
              <span className="font-semibold">Find Out 🔮</span>
              <span className="text-gray-500 text-xs">
                ({user?.findOutCount != null ? user.findOutCount : 0})
              </span>
            </button>
          </div>
        </div>

        {/* Details panel (optional) */}
        {user?.details && (
          <div className="mt-6">
            <div className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold">
              Details
            </div>
            <div className="border border-gray-200 border-t-0 rounded-b-lg p-4 flex flex-col space-y-2 text-gray-700 text-sm">
              {user.details.gender && (
                <div className="flex items-center space-x-2">
                  <span>👤</span>
                  <span>
                    {user.details.gender}
                    {user.details.orientation ? ` | ${user.details.orientation}` : ""}
                    {user.details.relationshipStatus
                      ? ` | ${user.details.relationshipStatus}`
                      : ""}
                  </span>
                </div>
              )}
              {user.details.bodyType && (
                <div className="flex items-center space-x-2">
                  <span>💪</span>
                  <span>{user.details.bodyType}</span>
                </div>
              )}
              {(user.details.ethnicity ||
                (user.details.languages && user.details.languages.length) ||
                user.details.education ||
                user.details.employment ||
                user.details.religion) && (
                <div className="flex items-center space-x-2">
                  <span>🌐</span>
                  <span className="truncate">
                    {[
                      user.details.ethnicity,
                      user.details.languages?.join(", "),
                      user.details.education,
                      user.details.employment,
                      user.details.religion,
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </span>
                </div>
              )}
              {(user.details.smoking ||
                user.details.drinking ||
                user.details.marijuana ||
                user.details.diet) && (
                <div className="flex items-center space-x-2">
                  <span>🚬</span>
                  <span>
                    {[
                      user.details.smoking,
                      user.details.drinking,
                      user.details.marijuana,
                      user.details.diet,
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </span>
                </div>
              )}
              {user.details.kids && (
                <div className="flex items-center space-x-2">
                  <span>👶</span>
                  <span>{user.details.kids}</span>
                </div>
              )}
              {user.details.pets && (
                <div className="flex items-center space-x-2">
                  <span>🐾</span>
                  <span>{user.details.pets}</span>
                </div>
              )}
              {user.details.lookingFor && (
                <div className="flex items-center space-x-2">
                  <span>🔍</span>
                  <span>{user.details.lookingFor}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

UserCard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string, // not required – we also accept _id
    _id: PropTypes.string,
    username: PropTypes.string,
    name: PropTypes.string,
    age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    compatibility: PropTypes.number,
    country: PropTypes.string,
    region: PropTypes.string,
    city: PropTypes.string,
    // Accept both string and {url} arrays in runtime (we normalize in component)
    photos: PropTypes.array,
    extraImages: PropTypes.array,
    youPhoto: PropTypes.string,
    profilePhoto: PropTypes.string,
    profilePicture: PropTypes.string,
    summary: PropTypes.string,
    agreeCount: PropTypes.number,
    disagreeCount: PropTypes.number,
    findOutCount: PropTypes.number,
    details: PropTypes.shape({
      gender: PropTypes.string,
      orientation: PropTypes.string,
      relationshipStatus: PropTypes.string,
      bodyType: PropTypes.string,
      ethnicity: PropTypes.string,
      languages: PropTypes.arrayOf(PropTypes.string),
      education: PropTypes.string,
      employment: PropTypes.string,
      religion: PropTypes.string,
      smoking: PropTypes.string,
      drinking: PropTypes.string,
      marijuana: PropTypes.string,
      diet: PropTypes.string,
      kids: PropTypes.string,
      pets: PropTypes.string,
      lookingFor: PropTypes.string,
    }),
  }).isRequired,
  onAction: PropTypes.func.isRequired,
};

export default memo(UserCard);
// --- REPLACE END ---
