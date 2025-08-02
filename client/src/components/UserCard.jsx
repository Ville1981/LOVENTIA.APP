// src/components/UserCard.jsx

import React, { useState, memo } from 'react';
import PropTypes from 'prop-types';

const UserCard = ({ user, onAction }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Käytetään user.username, mutta jos name‐kenttä on määritelty, se on ensisijainen
  const displayName = user.name || user.username || 'Unknown';

  // Jos photos ei ole taulukko tai se on tyhjä, käytetään placeholder-kuvaa
  const photos =
    Array.isArray(user.photos) && user.photos.length > 0
      ? user.photos
      : ['/uploads/bunny1.jpg', '/uploads/bunny2.jpg', '/uploads/bunny1.jpg'];

  // Fallback‐kuva profiilille, jos user.profilePhoto puuttuu
  const profilePhoto = user.profilePhoto || '/uploads/bunny1.jpg';
  // Fallback‐kuva “youPhoto”‐kentälle
  const youPhoto = user.youPhoto || '/uploads/bunny2.jpg';

  // Fallback‐kentät
  const compatibility = user.compatibility != null ? user.compatibility : 0;
  const age = user.age != null ? user.age : '?';
  const location =
    `${user.city || ''}${user.region ? ', ' + user.region : ''}${
      user.country ? ', ' + user.country : ''
    }`.replace(/^, /, '') || 'Unknown location';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
      {/* --- Kuvakaruselli: kolme kuvaa rinnakkain --- */}
      <div className="relative">
        <div className="grid grid-cols-3 gap-1">
          {photos.slice(0, 3).map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`${displayName} photo ${idx + 1}`}
              className="w-full h-32 object-cover rounded-t-lg"
            />
          ))}
        </div>
        {/* INTRO-painike kulmassa */}
        <button className="absolute bottom-2 right-2 bg-white text-[#005FFF] text-xs font-semibold py-1 px-2 rounded shadow-sm">
          INTRO
        </button>
      </div>

      {/* --- Kortin sisältö --- */}
      <div className="p-4 space-y-4">
        {/* — Nimi, Ikä & Sopivuusprosentti — */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">
            {displayName}, {age}
          </h3>
          <div className="w-10 h-10 border-2 border-[#005FFF] rounded-full flex items-center justify-center text-[#005FFF] font-bold">
            {compatibility}%
          </div>
        </div>

        {/* — Sijainti — */}
        <p className="text-gray-500">{location}</p>

        {/* — Toimintonapit: Pass / Like / Superlike — */}
        <div className="mt-4 flex items-center justify-between space-x-2">
          <button
            className="flex-1 border-2 border-black text-black py-2 rounded-full hover:bg-gray-100 transition duration-150"
            onClick={() => onAction(user.id, 'pass')}
          >
            ❌ Pass
          </button>
          <button
            className="flex-1 bg-[#FF4081] text-white py-2 rounded-full hover:opacity-90 transition duration-150"
            onClick={() => onAction(user.id, 'like')}
          >
            ❤️ Like
          </button>
          <button
            className="flex-1 bg-[#005FFF] text-white py-2 rounded-full hover:opacity-90 transition duration-150 flex items-center justify-center space-x-1"
            onClick={() => onAction(user.id, 'superlike')}
          >
            <span>⭐</span>
            <span>Superlike</span>
          </button>
        </div>

        {/* — My self-summary (Expand/Collapse) — */}
        <div className="mt-6">
          <div className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold">
            My self-summary
          </div>
          <div className="border border-gray-200 border-t-0 rounded-b-lg p-2">
            <p className={`text-gray-800 text-sm ${!isExpanded ? 'line-clamp-2' : ''}`}>
              {user.summary || '—'}
            </p>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#005FFF] text-xs font-medium mt-1"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {/* — You & [Profiili] — */}
        <div className="mt-6">
          <h4 className="text-gray-700 font-semibold mb-2">You & {displayName}</h4>
          <div className="flex items-center space-x-2 mb-2">
            <img
              src={youPhoto}
              alt="Your avatar"
              className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
            />
            <span className="text-lg font-bold text-[#005FFF]">{compatibility}%</span>
            <img
              src={profilePhoto}
              alt={`${displayName} avatar`}
              className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
            />
          </div>
          <div className="flex items-center space-x-6">
            <div
              className="flex items-center space-x-1 cursor-pointer hover:text-[#005FFF]"
              onClick={() => onAction(user.id, 'agree')}
            >
              <span className="font-semibold">Agree 😊</span>
              <span className="text-gray-500 text-xs">
                ({user.agreeCount != null ? user.agreeCount : 0})
              </span>
            </div>
            <div
              className="flex items-center space-x-1 cursor-pointer hover:text-gray-700"
              onClick={() => onAction(user.id, 'disagree')}
            >
              <span className="font-semibold">Disagree 😕</span>
              <span className="text-gray-500 text-xs">
                ({user.disagreeCount != null ? user.disagreeCount : 0})
              </span>
            </div>
            <div
              className="flex items-center space-x-1 cursor-pointer hover:text-[#3B5998]"
              onClick={() => onAction(user.id, 'findOut')}
            >
              <span className="font-semibold">Find Out 🔮</span>
              <span className="text-gray-500 text-xs">
                ({user.findOutCount != null ? user.findOutCount : 0})
              </span>
            </div>
          </div>
        </div>

        {/* — Details-paneeli — */}
        {user.details && (
          <div className="mt-6">
            <div className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold">
              Details
            </div>
            <div className="border border-gray-200 border-t-0 rounded-b-lg p-4 flex flex-col space-y-2 text-gray-700 text-sm">
              {user.details.gender && (
                <div className="flex items-center space-x-2">
                  <span>👤</span>
                  <span>
                    {user.details.gender} | {user.details.orientation} |{' '}
                    {user.details.relationshipStatus}
                  </span>
                </div>
              )}
              {user.details.bodyType && (
                <div className="flex items-center space-x-2">
                  <span>💪</span>
                  <span>{user.details.bodyType}</span>
                </div>
              )}
              {user.details.ethnicity && (
                <div className="flex items-center space-x-2">
                  <span>🌐</span>
                  <span>
                    {user.details.ethnicity} | {user.details.languages?.join(', ')} |{' '}
                    {user.details.education} | {user.details.employment} | {user.details.religion}
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
                    {user.details.smoking} | {user.details.drinking} | {user.details.marijuana} |{' '}
                    {user.details.diet}
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
    id: PropTypes.string.isRequired,
    username: PropTypes.string,
    name: PropTypes.string,
    age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    compatibility: PropTypes.number,
    country: PropTypes.string,
    region: PropTypes.string,
    city: PropTypes.string,
    photos: PropTypes.arrayOf(PropTypes.string),
    youPhoto: PropTypes.string,
    profilePhoto: PropTypes.string,
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
