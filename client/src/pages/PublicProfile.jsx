// PATH: client/src/pages/PublicProfile.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import api from "../utils/axiosInstance";
// --- REPLACE START: add helper to build absolute image URLs safely ---
import { BACKEND_BASE_URL } from "../utils/config";

/** Build a safe absolute URL for images.
 * - Leaves http(s) URLs as-is
 * - Normalizes relative paths to start with a single '/'
 * - Prefixes with BACKEND_BASE_URL for server-hosted uploads
 */
function buildImgSrc(p) {
  if (!p || typeof p !== "string") return "";
  if (/^https?:\/\//i.test(p)) return p;
  const norm = p.startsWith("/") ? p : `/${p}`;
  return `${BACKEND_BASE_URL}${norm}`;
}
// --- REPLACE END ---

const PublicProfile = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Fetch public profile via shared axios instance
        const res = await api.get(`/users/${id}`);
        setUser(res.data);
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    };
    fetchProfile();
  }, [id]);

  if (!user) return <p>Loading profile…</p>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">
        {user.name}, {user.age}
      </h1>

      {user.profilePicture && (
        <img
          // --- REPLACE START: fix literal string; use helper to resolve URL ---
          src={buildImgSrc(user.profilePicture)}
          // --- REPLACE END ---
          alt="Profile picture"
          className="w-40 h-40 object-cover rounded-full mx-auto mb-4"
          onError={(e) => {
            // fallback to a neutral placeholder if the src fails
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/placeholder-avatar-male.png";
          }}
        />
      )}

      {user.extraImages?.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {user.extraImages.map((img, i) => (
            <img
              key={i}
              // --- REPLACE START: fix literal string; use helper to resolve URL ---
              src={buildImgSrc(img)}
              // --- REPLACE END ---
              alt={`Extra photo ${i + 1}`}
              className="w-24 h-24 object-cover rounded"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/placeholder-avatar-male.png";
              }}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <strong>Relationship status:</strong> {user.status}
        </div>
        <div>
          <strong>Religion/values:</strong> {user.religion}
        </div>
        <div>
          <strong>Children:</strong> {user.children}
        </div>
        <div>
          <strong>Pets:</strong> {user.pets}
        </div>
        <div>
          <strong>Height:</strong> {user.height}
        </div>
        <div>
          <strong>Weight:</strong> {user.weight}
        </div>
      </div>

      <div className="mt-4">
        <p>
          <strong>📖 About me:</strong>
          <br />
          {user.summary}
        </p>
        <p className="mt-2">
          <strong>🎯 Goals:</strong>
          <br />
          {user.goal}
        </p>
        <p className="mt-2">
          <strong>💞 What I’m looking for:</strong>
          <br />
          {user.lookingFor}
        </p>
      </div>
    </div>
  );
};

export default PublicProfile;
