// File: client/src/pages/Photos.jsx

// --- REPLACE START: use unified axios instance and server-compatible endpoints ---
// --- REPLACE START: use centralized axios instance ---
import api from '../services/api/axiosInstance';
// --- REPLACE END ---
// --- REPLACE END ---
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Utility: normalize a relative image path to absolute URL if needed.
 */
function toAbsolute(src) {
  if (!src || typeof src !== "string") return "";
  if (/^https?:\/\//i.test(src)) return src;
  const base =
    (typeof window !== "undefined" && window.location?.origin) ||
    // --- REPLACE START: removed leftover localhost string ---
// --- REPLACE END ---
  const backend = base.replace(/:5173|:5174/, ":5000");
  const clean = src.startsWith("/") ? src : `/${src}`;
  return `${backend}${clean}`;
}

export default function Photos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  const userId = useMemo(
    () => params.userId || user?._id || user?.id,
    [params.userId, user]
  );
  const [extraImages, setExtraImages] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [photosFiles, setPhotosFiles] = useState([]);

  const isOwner = !params.userId || params.userId === (user?._id || user?.id);

  // Load current user profile (mainly to get extraImages)
  useEffect(() => {
    async function load() {
      try {
        // When viewing own profile, prefer /api/users/profile to avoid leaking ids
        const endpoint = isOwner ? "/api/users/profile" : `/api/users/${userId}`;
        const res = await api.get(endpoint);
        const u = res.data?.user || res.data || {};
        setExtraImages(Array.isArray(u.extraImages) ? u.extraImages : []);
      } catch (e) {
        console.error("Failed to load user photos", e);
      }
    }
    if (userId) load();
  }, [userId, isOwner]);

  const onSelectAvatar = (e) => setAvatarFile(e.target.files?.[0] || null);
  const onSelectPhotos = (e) =>
    setPhotosFiles(Array.from(e.target.files || []).slice(0, 20));

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    try {
      const fd = new FormData();
      fd.append("profilePhoto", avatarFile);
      await api.post(`/api/users/${userId}/upload-avatar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // refresh
      const res = await api.get(isOwner ? "/api/users/profile" : `/api/users/${userId}`);
      const u = res.data?.user || res.data || {};
      setExtraImages(Array.isArray(u.extraImages) ? u.extraImages : []);
    } catch (e) {
      console.error("Avatar upload failed", e);
    }
  };

  const uploadPhotos = async () => {
    if (!photosFiles.length) return;
    try {
      const fd = new FormData();
      photosFiles.forEach((f) => fd.append("photos", f));
      const res = await api.post(`/api/users/${userId}/upload-photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const next = res.data?.extraImages || [];
      setExtraImages(next);
    } catch (e) {
      console.error("Photos upload failed", e);
    }
  };

  const deleteSlot = async (idx) => {
    try {
      const res = await api.delete(`/api/users/${userId}/photos/${idx}`);
      const next = res.data?.extraImages || [];
      setExtraImages(next);
    } catch (e) {
      console.error("Delete slot failed", e);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Photos</h1>

      {isOwner && (
        <div className="space-y-4 p-4 rounded border">
          <h2 className="text-lg font-medium">Upload avatar</h2>
          <input type="file" accept="image/*" onChange={onSelectAvatar} />
          <button
            onClick={uploadAvatar}
            className="bg-blue-600 text-white px-4 py-2 rounded mt-2"
          >
            Upload avatar
          </button>
        </div>
      )}

      {isOwner && (
        <div className="space-y-4 p-4 rounded border">
          <h2 className="text-lg font-medium">Upload extra photos</h2>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onSelectPhotos}
          />
          <button
            onClick={uploadPhotos}
            className="bg-blue-600 text-white px-4 py-2 rounded mt-2"
          >
            Upload photos
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {(extraImages || []).map((src, i) => (
          <div key={i} className="relative group">
            <img
              src={toAbsolute(src)}
              alt={`Extra ${i + 1}`}
              className="object-cover w-full h-48 rounded"
            />
            {isOwner && (
              <button
                onClick={() => deleteSlot(i)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-red-600 text-white text-xs px-2 py-1 rounded"
                title="Delete"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate(-1)}
        className="bg-gray-200 px-4 py-2 rounded"
      >
        Back
      </button>
    </div>
  );
}













