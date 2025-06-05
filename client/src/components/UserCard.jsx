// src/components/UserCard.jsx

import React, { useState } from "react";

const UserCard = ({ user }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Jos user.photos ei ole taulukko tai on tyhjä, käytetään paikallista placeholderia
  const photos =
    Array.isArray(user.photos) && user.photos.length > 0
      ? user.photos
      : ["/ads/placeholder.jpg"];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
      {/* --- Kuvakaruselli --- */}
      <div className="relative">
        {/* Ensimmäinen kuva */}
        <img
          src={photos[0]}
          alt={`${user.name} photo 1`}
          className="w-full h-64 object-cover"
        />
        {/* Jos on useampia kuvia, näytetään nuoli-indikaattori */}
        {photos.length > 1 && (
          <div className="absolute top-0 right-0 m-2 text-white bg-black bg-opacity-40 px-2 py-1 rounded-full cursor-pointer">
            ▶
          </div>
        )}
      </div>

      {/* --- Kortin sisältö --- */}
      <div className="p-4 space-y-4">
        {/* — Nimi, Ikä & Sopivuusprosentti — */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">
            {user.name}, {user.age}
          </h3>
          <div className="w-10 h-10 border-2 border-[#005FFF] rounded-full flex items-center justify-center text-[#005FFF] font-bold">
            {user.compatibility}%
          </div>
        </div>

        {/* — Sijainti — */}
        <p className="text-gray-500">{user.location}</p>

        {/* — Toimintonapit: Pass / Like / Superlike — */}
        <div className="mt-4 flex items-center justify-between space-x-2">
          <button className="flex-1 border-2 border-black text-black py-2 rounded-full hover:bg-gray-100 transition duration-150">
            ❌ Pass
          </button>
          <button className="flex-1 bg-[#FF4081] text-white py-2 rounded-full hover:opacity-90 transition duration-150">
            ❤️ Like
          </button>
          <button className="flex-1 bg-[#005FFF] text-white py-2 rounded-full hover:opacity-90 transition duration-150 flex items-center justify-center space-x-1">
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
            <p
              className={`text-gray-800 text-sm ${
                !isExpanded ? "line-clamp-2" : ""
              }`}
            >
              {user.summary}
            </p>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#005FFF] text-xs font-medium mt-1"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {/* — You & [Profiili] — */}
        <div className="mt-6">
          <h4 className="text-gray-700 font-semibold mb-2">You & {user.name}</h4>
          <div className="flex items-center space-x-2 mb-2">
            <img
              src={user.youPhoto}
              alt="Your avatar"
              className="w-8 h-8 rounded-full object-cover"
            />
            <span className="text-lg font-bold text-[#005FFF]">
              {user.compatibility}%
            </span>
            <img
              src={user.profilePhoto}
              alt={`${user.name} avatar`}
              className="w-8 h-8 rounded-full object-cover"
            />
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-1 cursor-pointer hover:text-[#005FFF]">
              <span className="font-semibold">Agree 😊</span>
              <span className="text-gray-500 text-xs">({user.agreeCount})</span>
            </div>
            <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-700">
              <span className="font-semibold">Disagree 😕</span>
              <span className="text-gray-500 text-xs">
                ({user.disagreeCount})
              </span>
            </div>
            <div className="flex items-center space-x-1 cursor-pointer hover:text-[#3B5998]">
              <span className="font-semibold">Find Out 🔮</span>
              <span className="text-gray-500 text-xs">
                ({user.findOutCount})
              </span>
            </div>
          </div>
        </div>

        {/* — Details-paneeli — */}
        <div className="mt-6">
          <div className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold">
            Details
          </div>
          <div className="border border-gray-200 border-t-0 rounded-b-lg p-4 flex flex-col space-y-2 text-gray-700 text-sm">
            <div className="flex items-center space-x-2">
              <span>👤</span>
              <span>
                {user.details.gender} | {user.details.orientation} |{" "}
                {user.details.relationshipStatus}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span>💪</span>
              <span>{user.details.bodyType}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🌐</span>
              <span>
                {user.details.ethnicity} |{" "}
                {user.details.languages.join(", ")} | {user.details.education} |{" "}
                {user.details.employment} | {user.details.religion}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🚬</span>
              <span>
                {user.details.smoking} | {user.details.drinking} |{" "}
                {user.details.marijuana} | {user.details.diet}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span>👶</span>
              <span>{user.details.kids}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🐾</span>
              <span>{user.details.pets}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🔍</span>
              <span>{user.details.lookingFor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCard;
