// File: client/src/pages/ExtraPhotosPage.jsx

// --- REPLACE START: use shared api + services; keep structure and comments ---
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

import MultiStepPhotoUploader from "../components/profileFields/MultiStepPhotoUploader";
import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";
import { BACKEND_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { getUserProfile } from "../services/userService"; // centralized user fetch
import api from "../utils/axiosInstance"; // unified axios (Bearer + refresh)

const normalizePath = (p = "") =>
  "/" + p.replace(/\\/g, "/").replace(/^\/+/, "");

export default function ExtraPhotosPage() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const { userId: paramId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const userId = paramId || authUser?._id || authUser?.id;
  const isOwner =
    !paramId || authUser?._id === paramId || authUser?.id === paramId;

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getUserProfile(paramId); // null/undefined => /users/profile, else /users/:id
      const u = data?.user ?? data;
      setUser(u);
    } catch (err) {
      console.error("Error fetching user:", err);
      setError("Failed to load user.");
    }
  }, [paramId, userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    if (!paramId && typeof setAuthUser === "function") setAuthUser(updatedUser);
  };

  if (error) {
    return <div className="text-center mt-12 text-red-600">{error}</div>;
  }

  if (!user) {
    return <div className="text-center mt-12">Loading photos…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Manage Photos</h1>

      {isOwner ? (
        <MultiStepPhotoUploader
          userId={userId}
          isPremium={user.isPremium}
          extraImages={user.extraImages || []}
          onSuccess={(images) =>
            handleUserUpdate({ ...user, extraImages: images })
          }
          onError={(e) => console.error(e)}
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

      <ControlBar className="justify-center bg-gray-200">
        <Button variant="gray" onClick={() => navigate(-1)}>
          Back to Profile
        </Button>
      </ControlBar>
    </div>
  );
}
// --- REPLACE END ---
