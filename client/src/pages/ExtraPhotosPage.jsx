// src/pages/ExtraPhotosPage.jsx

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import MultiStepPhotoUploader from "../components/profileFields/MultiStepPhotoUploader";
import { uploadAvatar, removeAvatar as apiRemoveAvatar } from "../api/images";
import { BACKEND_BASE_URL } from "../config";
import ControlBar from "../components/ui/ControlBar";
import Button from "../components/ui/Button";

/**
 * Ensure leading slash and forward‐slashes only.
 */
const normalizePath = (p = "") =>
  "/" + p.replace(/\\/g, "/").replace(/^\/+/, "");

export default function ExtraPhotosPage() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const { userId: paramId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const [avatarMessage, setAvatarMessage] = useState("");

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

      const pic = u.profilePicture;
      setAvatarPreview(
        pic && typeof pic === "string"
          ? pic.startsWith("http")
            ? pic
            : `${BACKEND_BASE_URL}${normalizePath(pic)}`
          : "/placeholder-avatar.png"
      );
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

    const pic = updatedUser.profilePicture;
    setAvatarPreview(
      pic && typeof pic === "string"
        ? pic.startsWith("http")
          ? pic
          : `${BACKEND_BASE_URL}${normalizePath(pic)}`
        : "/placeholder-avatar.png"
    );
  };

  // File chooser for avatar
  const handleAvatarChange = (e) => {
    setAvatarError("");
    setAvatarMessage("");
    const file = e.target.files[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Submit avatar upload
  const handleAvatarSubmit = async (e) => {
    e.preventDefault();
    if (!avatarFile || !userId) return;
    setAvatarError("");
    setAvatarMessage("");
    try {
      const { profilePicture: newUrl } = await uploadAvatar(userId, avatarFile);
      handleUserUpdate({ ...user, profilePicture: newUrl });
      setAvatarFile(null);
      setAvatarMessage("Avatar saved");
    } catch (err) {
      console.error(err);
      setAvatarError("Failed to save avatar");
    }
  };

  // Remove avatar (slot 0)
  const handleAvatarRemove = async () => {
    if (!userId) return;
    setAvatarError("");
    setAvatarMessage("");
    try {
      const { profilePicture } = await apiRemoveAvatar(userId);
      handleUserUpdate({ ...user, profilePicture });
      setAvatarFile(null);
      setAvatarMessage("Avatar removed");
    } catch (err) {
      console.error(err);
      setAvatarError("Failed to remove avatar");
    }
  };

  if (!user) {
    return <div className="text-center mt-12">Loading photos...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Manage Photos</h1>

      {isOwner && (
        <form
          onSubmit={handleAvatarSubmit}
          className="flex flex-col items-center space-y-4"
        >
          {/* Avatar preview */}
          <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-blue-500">
            <img
              src={avatarPreview}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) =>
                (e.currentTarget.src = "/placeholder-avatar.png")
              }
            />
          </div>

          {/* Avatar controls */}
          <ControlBar className="bg-gray-200">
            <Button as="label" variant="gray" htmlFor="avatar-input">
              Browse...
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </Button>
            <span className="px-2 text-sm">
              {avatarFile ? avatarFile.name : "No file chosen"}
            </span>
            <Button type="submit" variant="purple" disabled={!avatarFile}>
              Save
            </Button>
            <Button type="button" variant="red" onClick={handleAvatarRemove}>
              Remove
            </Button>
          </ControlBar>

          {/* Status messages */}
          {avatarMessage && (
            <p className="text-green-600">{avatarMessage}</p>
          )}
          {avatarError && <p className="text-red-600">{avatarError}</p>}
        </form>
      )}

      {/* Extra photos uploader or display */}
      {isOwner ? (
        <MultiStepPhotoUploader
          userId={userId}
          isPremium={user.isPremium}
          extraImages={user.extraImages || []}
          onSuccess={(images) =>
            handleUserUpdate({ ...user, extraImages: images })
          }
          onError={() => {}}
        />
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
