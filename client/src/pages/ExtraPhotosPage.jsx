// src/pages/ExtraPhotosPage.jsx

import axios from "axios";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Removed unused imports for avatar uploads
// --- REPLACE START: remove unused image API imports ---
// import { uploadAvatar, removeAvatar as apiRemoveAvatar } from "../api/images";
// --- REPLACE END ---
import MultiStepPhotoUploader from "../components/profileFields/MultiStepPhotoUploader";
import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";
import { BACKEND_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

/**
 * Ensure leading slash and forward-slashes only.
 */
const normalizePath = (p = "") =>
  "/" + p.replace(/\\/g, "/").replace(/^\/+/, "");

export default function ExtraPhotosPage() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const { userId: paramId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const userId = paramId || authUser?._id;
  const isOwner = !paramId || authUser?._id === paramId;

  // Fetch user data (with credentials)
  const fetchUser = useCallback(async () => {
    if (!userId) return;
    try {
      const url = paramId
        ? `${BACKEND_BASE_URL}/api/users/${paramId}`
        : `${BACKEND_BASE_URL}/api/auth/me`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        withCredentials: true,
      });
      const u = res.data.user || res.data;
      setUser(u);
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  }, [paramId, userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Update local & global user
  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    if (!paramId) setAuthUser(updatedUser);
  };

  if (!user) {
    return <div className="text-center mt-12">Loading photos...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Manage Photos</h1>

      {isOwner ? (
        // --- REPLACE START: use unified MultiStepPhotoUploader for all steps ---
        <MultiStepPhotoUploader
          userId={userId}
          isPremium={user.isPremium}
          extraImages={user.extraImages || []}
          onSuccess={(images) =>
            handleUserUpdate({ ...user, extraImages: images })
          }
          onError={() => {}}
        />
        // --- REPLACE END ---
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {user.extraImages?.map((src, i) => {
            const imgSrc =
              src && typeof src === "string"
                ? src.startsWith("http")
                  ? src
                  : `${BACKEND_BASE_URL}${normalizePath(src)}`
                : "/placeholder-avatar.png";
            return (
              <img
                key={i}
                src={imgSrc}
                alt={`Extra ${i + 1}`}
                className="object-cover w-full h-48 rounded"
              />
            );
          })}
        </div>
      )}

      {/* Back button */}
      <ControlBar className="justify-center bg-gray-200">
        <Button variant="gray" onClick={() => navigate(-1)}>
          Back to Profile
        </Button>
      </ControlBar>
    </div>
  );
}
