// PATH: client/src/pages/ExtraPhotosPage.jsx

// --- REPLACE START: fix importer path to profileFields, keep logic and length; guard updates + add small info text ---
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import MultiStepPhotoUploader from "../components/profileFields/MultiStepPhotoUploader";

import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";
import { BACKEND_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { getUserProfile } from "../services/userService";

const normalizePath = (p = "") =>
  "/" + String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");

/**
 * Shallow compare arrays of strings to detect meaningful changes.
 */
function arraysEqual(a = [], b = []) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Normalize a photos list coming from either key and drop falsy values */
function pickPhotos(src) {
  const list = Array.isArray(src?.photos) && src.photos.length
    ? src.photos
    : Array.isArray(src?.extraImages)
    ? src.extraImages
    : [];
  return list.filter(Boolean).map(String);
}

export default function ExtraPhotosPage() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const { userId: paramId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  // Resolve a stable userId (memoized to avoid churn)
  const resolvedUserId = useMemo(() => {
    return (
      paramId ||
      authUser?._id ||
      authUser?.id ||
      user?._id ||
      user?.id ||
      null
    );
  }, [paramId, authUser?._id, authUser?.id, user?._id, user?.id]);

  const isOwner =
    !paramId ||
    authUser?._id === paramId ||
    authUser?.id === paramId;

  const fetchUser = useCallback(async () => {
    if (!resolvedUserId) return;
    try {
      const data = await getUserProfile(resolvedUserId);
      const u = data?.user ?? data;
      setUser(u);
    } catch (err) {
      console.error("Error fetching user:", err);
      setError("Failed to load user.");
    }
  }, [resolvedUserId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  /**
   * Update handler: updates local state and, if owner, also AuthContext.
   * Guards against redundant updates to avoid loops.
   */
  const handleUserUpdate = useCallback(
    (updated) => {
      if (!updated) return;

      // Normalize lists from either `photos` or `extraImages`
      const prevPhotos = pickPhotos(user);
      const nextPhotos = pickPhotos(updated);

      const prevPic = user?.profilePicture || null;
      const nextPic = updated?.profilePicture || null;

      const photosChanged = !arraysEqual(prevPhotos, nextPhotos);
      const picChanged = prevPic !== nextPic;

      if (photosChanged || picChanged) {
        setUser(updated);
        if (isOwner && typeof setAuthUser === "function") {
          // AuthContext has its own guard; pass the fresh object
          setAuthUser(updated);
        }
      }
    },
    [user, isOwner, setAuthUser]
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

      {/* Small helper info visible on owner view */}
      {isOwner && (
        <div className="rounded-md border border-blue-200 bg-blue-50 text-blue-900 text-sm p-3">
          <p>
            Select a file first to enable <strong>Save</strong>. To use an existing photo as your avatar,
            click <strong>“Make main”</strong> under that photo.
          </p>
        </div>
      )}

      {isOwner ? (
        <MultiStepPhotoUploader
          userId={resolvedUserId}
          isPremium={user.isPremium}
          photos={user.photos || user.extraImages || []}
          profilePicture={user.profilePicture}
          onSuccess={handleUserUpdate}
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
                onError={(e) => (e.currentTarget.src = "/placeholder-avatar.png")}
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
