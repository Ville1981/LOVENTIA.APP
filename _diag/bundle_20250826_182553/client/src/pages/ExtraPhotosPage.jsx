// --- REPLACE START: ensure userId prop always set & update both local and auth state ---
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

import MultiStepPhotoUploader from "../components/profileFields/MultiStepPhotoUploader";
import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";
import { BACKEND_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { getUserProfile } from "../services/userService";

const normalizePath = (p = "") =>
  "/" + p.replace(/\\/g, "/").replace(/^\/+/, "");

export default function ExtraPhotosPage() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const { userId: paramId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  // Always resolve to a valid userId if possible
  const resolvedUserId =
    paramId || authUser?._id || authUser?.id || user?._id || user?.id;

  const isOwner =
    !paramId ||
    authUser?._id === paramId ||
    authUser?.id === paramId;

  const fetchUser = useCallback(async () => {
    if (!resolvedUserId) return;
    try {
      const data = await getUserProfile(paramId);
      const u = data?.user ?? data;
      setUser(u);
    } catch (err) {
      console.error("Error fetching user:", err);
      setError("Failed to load user.");
    }
  }, [paramId, resolvedUserId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleUserUpdate = useCallback(
    (updated) => {
      setUser(updated);
      if (isOwner && typeof setAuthUser === "function") {
        setAuthUser(updated);
      }
    },
    [isOwner, setAuthUser]
  );

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
          userId={resolvedUserId}
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













