import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import MultiStepPhotoUploader from "../components/profileFields/MultiStepPhotoUploader";
import { uploadAvatar } from "../api/images";
import { BACKEND_BASE_URL } from "../config";

export default function ExtraPhotosPage() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const { userId: paramId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState(null);
  const [avatarMessage, setAvatarMessage] = useState("");

  const userId = paramId || authUser?._id;
  const isOwner = !paramId || authUser?._id === paramId;

  // Fetch user data
  const fetchUser = useCallback(async () => {
    if (!userId) return;
    try {
      const url = paramId
        ? `${BACKEND_BASE_URL}/api/users/${paramId}`
        : `${BACKEND_BASE_URL}/api/auth/me`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const u = res.data.user || res.data;
      setUser(u);
      const pic = u.profilePicture;
      setAvatarPreview(
        pic && typeof pic === "string"
          ? pic.startsWith("http")
            ? pic
            : `${BACKEND_BASE_URL}${pic}`
          : "/placeholder-avatar.png"
      );
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  }, [paramId, userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Update both local and context
  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    if (!paramId) setAuthUser(updatedUser);
    const pic = updatedUser.profilePicture;
    setAvatarPreview(
      pic && typeof pic === "string"
        ? pic.startsWith("http")
          ? pic
          : `${BACKEND_BASE_URL}${pic}`
        : "/placeholder-avatar.png"
    );
  };

  // Avatar selection
  const handleAvatarChange = (e) => {
    setAvatarError(null);
    setAvatarMessage("");
    const file = e.target.files[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Submit avatar
  const handleAvatarSubmit = async (e) => {
    e.preventDefault();
    if (!avatarFile || !userId) return;
    setAvatarError(null);
    setAvatarMessage("");
    try {
      const result = await uploadAvatar(userId, avatarFile);
      const newUrl = typeof result === "string" ? result : result.profilePicture;
      handleUserUpdate({ ...user, profilePicture: newUrl });
      setAvatarFile(null);
      setAvatarMessage("Avatar saved");
    } catch (err) {
      setAvatarError("Failed to save avatar");
    }
  };

  if (!user) {
    return <div className="text-center mt-12">Loading photos…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Page title */}
      <h1 className="text-2xl font-semibold">Manage Photos</h1>

      {isOwner && (
        <form onSubmit={handleAvatarSubmit} className="flex flex-col items-center space-y-6">
          {/* Static avatar preview */}
          <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-blue-500 mx-auto">
            <img
              src={avatarPreview}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.src = "/placeholder-avatar.png")}
            />
          </div>

          {/* Avatar upload controls */}
          <div className="flex space-x-4">
            <label className="px-4 py-2 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700">
              Add Avatar
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
            <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
              Save Avatar
            </button>
          </div>

          {/* Avatar status messages */}
          {avatarMessage && <p className="text-green-600">{avatarMessage}</p>}
          {avatarError && <p className="text-red-600">{avatarError}</p>}
        </form>
      )}

      {isOwner ? (
        <MultiStepPhotoUploader
          userId={userId}
          isPremium={user.isPremium}
          extraImages={user.extraImages || []}
          onSuccess={(images) => handleUserUpdate({ ...user, extraImages: images })}
          onError={() => {}}
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {user.extraImages?.map((src, i) => {
            const imgSrc =
              src && typeof src === "string"
                ? src.startsWith("http")
                  ? src
                  : `${BACKEND_BASE_URL}${src}`
                : "/placeholder-avatar.png";
            return <img key={i} src={imgSrc} alt={`Extra ${i + 1}`} className="object-cover w-full h-48 rounded" />;
          })}
        </div>
      )}

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="mt-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
      >
        Back to Profile
      </button>
    </div>
  );
}
