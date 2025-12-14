// PATH: client/src/pages/Photos.jsx

// --- REPLACE START: normalize paths + guard refreshImages from loops; only update state on meaningful changes ---
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api/axiosInstance";
import { useAuth } from "../contexts/AuthContext";

/**
 * Convert any path to a browser-friendly relative path:
 * - Replace backslashes with forward slashes
 */
function toWebPath(p) {
  return (p || "").replace(/\\/g, "/");
}

/**
 * Build absolute URL to backend for relative assets.
 * - Respects Vite env `VITE_BACKEND_ORIGIN` if present
 * - Otherwise swaps dev ports 5173/5174 → 5000
 */
function toAbsolute(src) {
  if (!src || typeof src !== "string") return "";
  if (/^https?:\/\//i.test(src)) return src;

  const origin =
    (import.meta.env && import.meta.env.VITE_BACKEND_ORIGIN) ||
    (typeof window !== "undefined"
      ? window.location.origin.replace(/:(5173|5174)$/, ":5000")
      : "");

  const cleanRel = toWebPath(src).replace(/^\/+/, ""); // no leading slashes
  return `${origin}/${cleanRel}`;
}

/**
 * Compare arrays of strings by value (not reference).
 */
function arraysEqual(a = [], b = []) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a[i] || "") !== (b[i] || "")) return false;
  }
  return true;
}

/**
 * Small helper to detect "missing route" responses without importing axios types.
 */
function isLikelyNotFound(err) {
  const status = err?.response?.status;
  return status === 404;
}

export default function Photos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  // Stable userId
  const userId = useMemo(
    () => params.userId || user?._id || user?.id || null,
    [params.userId, user?._id, user?.id]
  );

  const [extraImages, setExtraImages] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [photosFiles, setPhotosFiles] = useState([]);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [slotBusyIdx, setSlotBusyIdx] = useState(null);

  const isOwner = !params.userId || params.userId === (user?._id || user?.id);

  // Prevent overlapping refreshes
  const refreshInFlightRef = useRef(null);

  // Load current user's photos (extraImages preferred, fallback to photos)
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!userId) return;
      try {
        // NOTE: api already has baseURL ".../api"
        const endpoint = isOwner ? "/users/profile" : `/users/${userId}`;
        const res = await api.get(endpoint);

        const u = res.data?.user || res.data || {};
        const images = Array.isArray(u.extraImages)
          ? u.extraImages
          : Array.isArray(u.photos)
          ? u.photos
          : [];

        if (alive && !arraysEqual(extraImages, images)) {
          setExtraImages(images);
        }
      } catch (e) {
        console.error("Failed to load user photos", e);
      }
    }
    load();
    return () => {
      alive = false;
    };
    // Only re-run on identity change of userId/ownership
  }, [userId, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSelectAvatar = (e) => setAvatarFile(e.target.files?.[0] || null);
  const onSelectPhotos = (e) =>
    setPhotosFiles(Array.from(e.target.files || []).slice(0, 20));

  /**
   * Refresh photos from server once (guarded against concurrent calls).
   * This is invoked only after user actions, not on mount loops.
   */
  const refreshImages = useCallback(async () => {
    if (!userId) return;
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const task = (async () => {
      try {
        // NOTE: api already has baseURL ".../api"
        const endpoint = isOwner ? "/users/profile" : `/users/${userId}`;
        const res = await api.get(endpoint);

        const u = res.data?.user || res.data || {};
        const images = Array.isArray(u.extraImages)
          ? u.extraImages
          : Array.isArray(u.photos)
          ? u.photos
          : [];

        if (!arraysEqual(extraImages, images)) {
          setExtraImages(images);
        }
      } catch (e) {
        console.error("Refresh photos failed", e);
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = task;
    return task;
  }, [userId, isOwner, extraImages]);

  const uploadAvatar = async () => {
    if (!avatarFile || !userId) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("profilePhoto", avatarFile);

      // NOTE: api already has baseURL ".../api"
      await api.post(`/users/${userId}/upload-avatar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await refreshImages();
      setAvatarFile(null);
    } catch (e) {
      console.error("Avatar upload failed", e);
      // If you later decide to unify avatar upload with another endpoint, do it here.
    } finally {
      setAvatarUploading(false);
    }
  };

  const uploadPhotos = async () => {
    if (!photosFiles.length || !userId) return;
    setPhotosUploading(true);
    try {
      const fd = new FormData();
      photosFiles.forEach((f) => fd.append("photos", f));

      // NOTE: api already has baseURL ".../api"
      const res = await api.post(`/users/${userId}/upload-photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const next =
        (Array.isArray(res.data?.extraImages) && res.data.extraImages) ||
        (Array.isArray(res.data?.photos) && res.data.photos) ||
        [];

      if (!arraysEqual(extraImages, next)) {
        setExtraImages(next);
      }
      setPhotosFiles([]);
    } catch (e) {
      console.error("Photos upload failed", e);

      /**
       * Optional compatibility note (kept as a comment only):
       * If your server uses the canonical route POST /api/users/:id/photos (field "photos"),
       * you can switch to: await api.post(`/users/${userId}/photos`, fd, { ... })
       */
    } finally {
      setPhotosUploading(false);
    }
  };

  const deleteSlot = async (idx) => {
    if (!userId) return;
    setSlotBusyIdx(idx);
    try {
      // NOTE: api already has baseURL ".../api"
      const res = await api.delete(`/users/${userId}/photos/${idx}`);

      const next =
        (Array.isArray(res.data?.extraImages) && res.data.extraImages) ||
        (Array.isArray(res.data?.photos) && res.data.photos) ||
        [];

      if (!arraysEqual(extraImages, next)) {
        setExtraImages(next);
      }
    } catch (e) {
      console.error("Delete slot failed", e);
    } finally {
      setSlotBusyIdx(null);
    }
  };

  /**
   * "Make main" (best-effort):
   * If the backend route exists, it will set the selected slot as the avatar/main photo.
   * If not, it fails gracefully without breaking the page.
   */
  const makeMain = async (idx) => {
    if (!userId) return;
    setSlotBusyIdx(idx);
    try {
      // NOTE: api already has baseURL ".../api"
      await api.post(`/users/${userId}/set-avatar`, { index: idx });
      await refreshImages();
    } catch (e) {
      // Do not hard-fail UI if this route is not available in your current server build.
      if (isLikelyNotFound(e)) {
        console.warn("Make main endpoint not found (skip): /users/:id/set-avatar");
      } else {
        console.error("Make main failed", e);
      }
    } finally {
      setSlotBusyIdx(null);
    }
  };

  /**
   * Normalize paths before rendering:
   * IMPORTANT: keep original indexes to avoid deleting the wrong slot.
   */
  const normalizedSlots = useMemo(() => {
    const list = Array.isArray(extraImages) ? extraImages : [];
    return list
      .map((raw, idx) => ({
        idx,
        raw: raw || "",
        src: toAbsolute(raw),
      }))
      .filter((x) => Boolean(x.src));
  }, [extraImages]);

  const hasImages = normalizedSlots.length > 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Manage Photos</h1>
          <p className="text-sm text-gray-600">
            Upload, review, and manage your profile photos.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => refreshImages()}
            className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded border"
            title="Refresh images"
          >
            Refresh
          </button>
          <button
            onClick={() => navigate(-1)}
            className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded border"
          >
            Back
          </button>
        </div>
      </div>

      {isOwner && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Avatar upload card */}
          <div className="space-y-3 p-4 rounded-xl border bg-white">
            <div>
              <h2 className="text-lg font-medium">Upload avatar</h2>
              <p className="text-sm text-gray-600">
                Choose a main profile photo (avatar).
              </p>
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={onSelectAvatar}
              className="block w-full text-sm"
            />

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-600 truncate">
                {avatarFile ? `Selected: ${avatarFile.name}` : "No file selected"}
              </div>

              <button
                onClick={uploadAvatar}
                disabled={!avatarFile || avatarUploading}
                className={[
                  "px-4 py-2 rounded text-white",
                  !avatarFile || avatarUploading
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700",
                ].join(" ")}
              >
                {avatarUploading ? "Uploading..." : "Upload avatar"}
              </button>
            </div>
          </div>

          {/* Extra photos upload card */}
          <div className="space-y-3 p-4 rounded-xl border bg-white">
            <div>
              <h2 className="text-lg font-medium">Upload extra photos</h2>
              <p className="text-sm text-gray-600">
                You can upload up to 20 photos at a time.
              </p>
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onSelectPhotos}
              className="block w-full text-sm"
            />

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-600 truncate">
                {photosFiles.length
                  ? `Selected: ${photosFiles.length} file(s)`
                  : "No files selected"}
              </div>

              <button
                onClick={uploadPhotos}
                disabled={!photosFiles.length || photosUploading}
                className={[
                  "px-4 py-2 rounded text-white",
                  !photosFiles.length || photosUploading
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700",
                ].join(" ")}
              >
                {photosUploading ? "Uploading..." : "Upload photos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photos grid */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-medium">Your photos</h2>
          <div className="text-xs text-gray-600">
            {hasImages ? `${normalizedSlots.length} photo(s)` : "No photos yet"}
          </div>
        </div>

        {!hasImages ? (
          <div className="p-6 rounded-xl border bg-gray-50 text-sm text-gray-700">
            No photos found. Upload an avatar or extra photos to see them here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {normalizedSlots.map((slot) => (
              <div
                key={slot.idx}
                className="rounded-xl border bg-white overflow-hidden flex flex-col"
              >
                <div className="relative">
                  <img
                    src={slot.src}
                    alt={`Photo ${slot.idx + 1}`}
                    className="object-cover w-full h-56"
                    onError={(e) => {
                      // Keep layout stable on broken image
                      e.currentTarget.style.opacity = "0.15";
                      e.currentTarget.style.filter = "grayscale(1)";
                    }}
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded">
                    Slot {slot.idx + 1}
                  </div>
                </div>

                <div className="p-3 flex flex-col gap-2">
                  {/* Action row */}
                  {isOwner ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => makeMain(slot.idx)}
                        disabled={slotBusyIdx === slot.idx}
                        className={[
                          "px-3 py-2 rounded border text-sm",
                          slotBusyIdx === slot.idx
                            ? "bg-gray-100 cursor-not-allowed"
                            : "bg-white hover:bg-gray-50",
                        ].join(" ")}
                        title="Set as main photo"
                      >
                        {slotBusyIdx === slot.idx ? "Working..." : "Make main"}
                      </button>

                      <button
                        onClick={() => deleteSlot(slot.idx)}
                        disabled={slotBusyIdx === slot.idx}
                        className={[
                          "px-3 py-2 rounded text-sm text-white",
                          slotBusyIdx === slot.idx
                            ? "bg-red-300 cursor-not-allowed"
                            : "bg-red-600 hover:bg-red-700",
                        ].join(" ")}
                        title="Remove this photo"
                      >
                        {slotBusyIdx === slot.idx ? "Working..." : "Remove"}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600">
                      Viewing photos as a guest.
                    </div>
                  )}

                  {/* Small technical hint (non-intrusive) */}
                  <div className="text-[11px] text-gray-500 break-all">
                    {slot.raw ? toWebPath(slot.raw) : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// --- REPLACE END ---

