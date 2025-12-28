// PATH: client/src/components/profileFields/MultiStepPhotoUploader.jsx

// --- REPLACE START: fix responsive layout so controls never overlap (wrap/stack), keep logic intact ---
import PropTypes from "prop-types";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import api from "../../services/api/axiosInstance";
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from "../../config";
import Button from "../ui/Button";
import ControlBar from "../ui/ControlBar";
import { normalizeUserImages } from "../../utils/absolutizeImage";

/**
 * Return true if value looks like an absolute http(s) URL.
 */
const isAbsoluteUrl = (s) =>
  typeof s === "string" && /^https?:\/\//i.test(s);

/**
 * Extract a usable photo string from either:
 *  - plain string
 *  - { url: "..." }
 *  - otherwise returns null
 */
const extractPhotoSrc = (item) => {
  if (!item) return null;
  if (typeof item === "string") return item;
  if (typeof item === "object" && item.url) return String(item.url);
  return null;
};

/**
 * Normalize Windows backslashes (\) → forward slash (/)
 * and make sure it starts with a single leading slash for relative paths.
 * Absolute http(s) URLs are returned as-is.
 */
const normalizePath = (p = "") => {
  const raw = String(p || "");
  if (!raw) return "";
  // Keep S3 / external URLs untouched
  if (isAbsoluteUrl(raw)) return raw;
  return "/" + raw.replace(/\\/g, "/").replace(/^\/+/, "");
};

/**
 * Normalize user payload from backend to a stable shape the UI expects.
 * Guarantees:
 *  - relative paths have a single leading '/'
 *  - absolute URLs (S3 etc.) are kept as-is
 *  - user.photos === user.extraImages (alias with the same list)
 *  - profile picture available as user.profilePicture (fallback profilePhoto)
 * Uses normalizeUserImages as the primary helper so behavior stays aligned
 * with UserProfile and ExtraPhotosPage.
 */
function normalizeUserOut(u) {
  if (!u || typeof u !== "object") return null;

  let baseUser = u;
  let photos = [];
  let profilePic = u.profilePicture || u.profilePhoto || null;

  try {
    const imgNorm = normalizeUserImages(u);
    if (imgNorm && typeof imgNorm === "object") {
      if (imgNorm.user && typeof imgNorm.user === "object") {
        baseUser = imgNorm.user;
      }
      if (Array.isArray(imgNorm.photos)) {
        photos = imgNorm.photos
          .map((item) => extractPhotoSrc(item))
          .filter(Boolean);
      } else if (Array.isArray(imgNorm.extraImages)) {
        photos = imgNorm.extraImages
          .map((item) => extractPhotoSrc(item))
          .filter(Boolean);
      }
      if (imgNorm.profilePicture) {
        profilePic = imgNorm.profilePicture;
      }
    }
  } catch (err) {
    // Do not break uploader if helper throws; fall back to local logic.
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[MultiStepPhotoUploader] normalizeUserImages failed:", err);
    }
  }

  // Fallback if normalizeUserImages did not provide photos
  if (!photos.length) {
    const rawList =
      Array.isArray(u.photos) && u.photos.length
        ? u.photos
        : Array.isArray(u.extraImages)
        ? u.extraImages
        : [];
    photos = rawList.map((item) => extractPhotoSrc(item)).filter(Boolean);
  }

  // Normalize list of photos to proper paths
  const normList = photos.map((s) => normalizePath(s));

  // Normalize avatar
  let avatar = profilePic ? extractPhotoSrc(profilePic) : null;
  avatar = avatar ? normalizePath(avatar) : null;
  if (!avatar && normList[0]) {
    avatar = normList[0];
  }

  const copy = { ...baseUser };
  copy.photos = normList;
  copy.extraImages = normList; // alias kept in sync
  copy.profilePicture = avatar || null;

  return copy;
}

/**
 * Compare two photo arrays by content (string equality), ignoring references.
 * Returns true if different (meaningful change).
 */
function photosChanged(prevArr = [], nextArr = []) {
  const a = (prevArr || []).map((x) => x || "");
  const b = (nextArr || []).map((x) => x || "");
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

/**
 * Resolve backend absolute URL for an image path or return external URL.
 * Accepts:
 *  - absolute http(s) URL (S3 etc.) → returned as-is
 *  - relative '/uploads/...' path → BACKEND_BASE_URL + path
 */
function resolveImg(srcLike, fallback = PLACEHOLDER_IMAGE) {
  if (!srcLike) return fallback;
  const s = String(srcLike);
  if (isAbsoluteUrl(s)) return s;
  return `${BACKEND_BASE_URL}${normalizePath(s)}`;
}

/**
 * MultiStepPhotoUploader
 * -----------------------------------------------------------------------------
 * - Avatar is always visual slot 0 (title card).
 * - photos and extraImages are mirrored and normalized via normalizeUserOut()
 *   which itself uses normalizeUserImages internally.
 * - onSuccess receives a normalized user object to avoid state loops higher up.
 * - "Make main" moves an existing photo to slot 0 (avatar) without re-upload.
 */
export default function MultiStepPhotoUploader({
  userId,
  isPremium = false,
  photos = [],
  profilePicture: initialProfilePicture = null,
  onSuccess = () => {},
  onError = () => {},
}) {
  const { t } = useTranslation();
  const maxSlots = isPremium ? 50 : 9;

  // Local mirrors for UI updates (keeps grid stable while saving)
  const [localPhotos, setLocalPhotos] = useState(
    Array.from({ length: maxSlots }, (_, i) => extractPhotoSrc(photos[i]) || null)
  );
  const [avatar, setAvatar] = useState(
    extractPhotoSrc(initialProfilePicture) || extractPhotoSrc(photos[0]) || null
  );

  // Track images that failed to load (for small UI hint)
  const [imageErrors, setImageErrors] = useState({});

  // Bulk state
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkError, setBulkError] = useState("");

  // Per-slot staged file map { [slotIdx]: File }
  const [stagedFiles, setStagedFiles] = useState({});

  // Uploading flags (per slot and bulk) to prevent repeated clicks
  const [savingSlots, setSavingSlots] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);

  // Refs for inputs
  const slotInputRefs = useRef([]);
  const bulkInputRef = useRef(null);

  if (slotInputRefs.current.length !== maxSlots) {
    slotInputRefs.current = Array(maxSlots)
      .fill()
      .map((_, i) => slotInputRefs.current[i] || React.createRef());
  }

  // Sync when parent props change (e.g., profile fetched elsewhere)
  useEffect(() => {
    const nextPhotos = Array.from({ length: maxSlots }, (_, i) =>
      extractPhotoSrc(photos[i]) || null
    );
    if (photosChanged(localPhotos, nextPhotos)) {
      setLocalPhotos(nextPhotos);
    }
    const nextAvatar =
      extractPhotoSrc(initialProfilePicture) || extractPhotoSrc(photos[0]) || null;
    if (avatar !== nextAvatar) {
      setAvatar(nextAvatar);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, maxSlots, initialProfilePicture]);

  /* ------------------------------- API helpers ------------------------------- */

  /**
   * POST /api/users/:id/upload-photo-step
   * Body: FormData { photo, slot }
   */
  async function apiUploadPhotoStep(uid, formData) {
    // The axiosInstance has baseURL ending with /api
    const url = `/users/${encodeURIComponent(uid)}/upload-photo-step`;
    const res = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const user = normalizeUserOut(res?.data?.user || res?.data || null);
    if (!user) throw new Error("Malformed upload-photo-step response");
    return user;
  }

  /**
   * POST /api/users/:id/upload-photos
   * Body: FormData { photos[] }
   */
  async function apiUploadPhotos(uid, formData) {
    const url = `/users/${encodeURIComponent(uid)}/upload-photos`;
    const res = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const user = normalizeUserOut(res?.data?.user || res?.data || null);
    if (!user) throw new Error("Malformed upload-photos response");
    return user;
  }

  /**
   * DELETE /api/users/:id/photos/:slot
   */
  async function apiDeletePhotoSlot(uid, slotIdx) {
    const idx = Number.isFinite(slotIdx) ? slotIdx : parseInt(slotIdx, 10);
    if (!Number.isInteger(idx) || idx < 0) throw new Error("Invalid slot index");
    const url = `/users/${encodeURIComponent(uid)}/photos/${encodeURIComponent(idx)}`;
    const res = await api.delete(url);
    const user = normalizeUserOut(res?.data?.user || res?.data || null);
    if (!user) throw new Error("Malformed delete-photo response");
    return user;
  }

  /**
   * Try to set avatar using existing photo without uploading a new file.
   * Tries a few known endpoints. All are safe no-ops if not present.
   *
   * Preference:
   *   1) PUT /api/users/:id/photos/reorder  { order: string[] }
   *   2) POST /api/users/:id/set-avatar     { path, index }
   *   3) PATCH /api/users/:id               { profilePicture, photos }
   */
  async function apiSetAvatarFromExisting(uid, currentList, fromIndex) {
    const list = (currentList || []).filter(Boolean);
    if (
      !list.length ||
      fromIndex == null ||
      fromIndex < 0 ||
      fromIndex >= list.length
    ) {
      throw new Error("Invalid source index for Make main");
    }

    // Move selected to front (slot 0 becomes avatar)
    const picked = list[fromIndex];
    const reordered = [picked, ...list.filter((_, i) => i !== fromIndex)];

    // 1) Reorder endpoint (preferred if exists)
    try {
      const res = await api.put(
        `/users/${encodeURIComponent(uid)}/photos/reorder`,
        {
          order: reordered,
        }
      );
      const user = normalizeUserOut(res?.data?.user || res?.data || null);
      if (user) return user;
    } catch (_) {
      // continue to option 2
    }

    // 2) Explicit set-avatar endpoint (if present)
    try {
      const payload = { path: picked, index: fromIndex };
      const res = await api.post(
        `/users/${encodeURIComponent(uid)}/set-avatar`,
        payload
      );
      const user = normalizeUserOut(res?.data?.user || res?.data || null);
      if (user) return user;
    } catch (_) {
      // continue to option 3
    }

    // 3) Generic PATCH to user (final fallback)
    try {
      const res = await api.patch(`/users/${encodeURIComponent(uid)}`, {
        profilePicture: picked,
        photos: reordered,
      });
      const user = normalizeUserOut(res?.data?.user || res?.data || null);
      if (user) return user;
    } catch (err) {
      throw err;
    }

    throw new Error("Failed to set avatar from existing photo");
  }

  /* --------------------------------- Handlers -------------------------------- */

  const handleSlotChange = (idx, e) => {
    const file = e.target.files?.[0] || null;
    // Do NOT auto-upload on change; wait for explicit "Save"
    setStagedFiles((prev) => ({ ...prev, [idx]: file }));
  };

  const handleSlotSave = async (idx) => {
    const file = stagedFiles[idx];
    if (!file || savingSlots[idx]) return;

    try {
      setSavingSlots((m) => ({ ...m, [idx]: true }));

      const form = new FormData();
      form.append("photo", file); // ✅ field name: photo
      form.append("slot", String(idx)); // ✅ field name: slot

      const user = await apiUploadPhotoStep(userId, form);
      const updatedPhotos = Array.isArray(user?.photos) ? user.photos : [];

      // Guard: update local state ONLY when content changed
      if (photosChanged(localPhotos, updatedPhotos)) {
        setLocalPhotos(
          Array.from({ length: maxSlots }, (_, i) => updatedPhotos[i] || null)
        );
      }
      const nextAvatar = user?.profilePicture || updatedPhotos[0] || null;
      if (avatar !== nextAvatar) setAvatar(nextAvatar);

      // Reset any previous error for this slot
      setImageErrors((prev) => {
        const copy = { ...prev };
        delete copy[idx];
        if (idx === 0) delete copy[0];
        return copy;
      });

      // ✅ Pass normalized user to parent (safe against loops when parent normalizes too)
      onSuccess(user);

      // Clear staged file for this slot
      setStagedFiles((prev) => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
    } catch (err) {
      onError(err);
    } finally {
      setSavingSlots((m) => {
        const copy = { ...m };
        delete copy[idx];
        return copy;
      });
    }
  };

  const handleDelete = async (idx) => {
    // UI disables Remove for empty slots; extra guards remain for safety
    if (savingSlots[idx] || !Number.isInteger(idx) || idx < 0) return;

    try {
      setSavingSlots((m) => ({ ...m, [idx]: true }));
      const user = await apiDeletePhotoSlot(userId, idx);
      const updatedPhotos = Array.isArray(user?.photos) ? user.photos : [];

      if (photosChanged(localPhotos, updatedPhotos)) {
        setLocalPhotos(
          Array.from({ length: maxSlots }, (_, i) => updatedPhotos[i] || null)
        );
      }
      const nextAvatar = user?.profilePicture || updatedPhotos[0] || null;
      if (avatar !== nextAvatar) setAvatar(nextAvatar);

      // Clear any error flag for this slot
      setImageErrors((prev) => {
        const copy = { ...prev };
        delete copy[idx];
        if (idx === 0) delete copy[0];
        return copy;
      });

      // ✅ Pass normalized user to parent
      onSuccess(user);
    } catch (err) {
      onError(err);
    } finally {
      setSavingSlots((m) => {
        const copy = { ...m };
        delete copy[idx];
        return copy;
      });
    }
  };

  const handleBulkChange = (e) => {
    setBulkFiles(Array.from(e.target.files || []));
    setBulkError("");
  };

  const handleBulkUpload = async () => {
    if (!bulkFiles.length || bulkSaving) return;
    try {
      setBulkSaving(true);

      const form = new FormData();
      // ✅ field name: photos
      bulkFiles.forEach((f) => form.append("photos", f));

      const user = await apiUploadPhotos(userId, form);
      const updatedPhotos = Array.isArray(user?.photos) ? user.photos : [];

      if (photosChanged(localPhotos, updatedPhotos)) {
        setLocalPhotos(
          Array.from({ length: maxSlots }, (_, i) => updatedPhotos[i] || null)
        );
      }
      const nextAvatar = user?.profilePicture || updatedPhotos[0] || null;
      if (avatar !== nextAvatar) setAvatar(nextAvatar);

      // Clear all image error markers (fresh list from server)
      setImageErrors({});

      // ✅ Pass normalized user to parent
      onSuccess(user);
      setBulkFiles([]);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    } catch (err) {
      setBulkError(err?.response?.data?.error || err.message || "Upload failed");
      onError(err);
    } finally {
      setBulkSaving(false);
    }
  };

  /**
   * Make the selected existing photo the main one (avatar) without uploading.
   * Note: localPhotos mirrors server order, so using idx directly is safe.
   */
  const handleMakeMain = async (idx) => {
    if (savingSlots[`mk_${idx}`]) return;

    try {
      setSavingSlots((m) => ({ ...m, [`mk_${idx}`]: true }));
      const list = localPhotos.filter(Boolean);
      const fromIndex = idx;

      const user = await apiSetAvatarFromExisting(userId, list, fromIndex);

      const updatedPhotos = Array.isArray(user?.photos) ? user.photos : [];
      if (photosChanged(localPhotos, updatedPhotos)) {
        setLocalPhotos(
          Array.from({ length: maxSlots }, (_, i) => updatedPhotos[i] || null)
        );
      }
      const nextAvatar = user?.profilePicture || updatedPhotos[0] || null;
      if (avatar !== nextAvatar) setAvatar(nextAvatar);

      // Clear possible errors for this index and avatar
      setImageErrors((prev) => {
        const copy = { ...prev };
        delete copy[idx];
        delete copy[0];
        return copy;
      });

      // ✅ Pass normalized user to parent
      onSuccess(user);
    } catch (err) {
      onError(err);
    } finally {
      setSavingSlots((m) => {
        const copy = { ...m };
        delete copy[`mk_${idx}`];
        return copy;
      });
    }
  };

  /* ---------------------------------- UI ------------------------------------ */

  // Helper to render a Save button that clearly looks disabled when no file is chosen
  function SaveButton({ disabled, onClick, busy }) {
    const base =
      "min-w-[96px] inline-flex items-center justify-center px-3 py-2 rounded transition";
    const enabledCls = "bg-blue-600 text-white hover:bg-blue-700";
    const disabledCls =
      "bg-gray-300 text-gray-600 cursor-not-allowed border border-gray-300 opacity-70";
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        aria-disabled={disabled ? "true" : "false"}
        title={disabled ? t("Select a file first") : ""}
        className={`${base} ${disabled ? disabledCls : enabledCls}`}
      >
        {busy ? t("Saving…") : t("Save")}
      </button>
    );
  }

  return (
    <div>
      {/* Avatar slot (slot 0 visual) */}
      <div className="border rounded-lg p-4 bg-gray-100 mb-4 flex flex-col items-center">
        <img
          src={resolveImg(avatar)}
          alt="Avatar"
          className="w-32 h-32 rounded-full object-cover mb-2"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER_IMAGE;
            setImageErrors((prev) => ({ ...prev, 0: true }));
          }}
        />
        <input
          ref={slotInputRefs.current[0]}
          type="file"
          accept="image/*"
          onChange={(e) => handleSlotChange(0, e)}
          className="hidden"
        />

        {/* --- REPLACE START: responsive control layout (wrap/stack) to prevent overlaps --- */}
        <ControlBar className="w-full flex flex-col gap-2">
          <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
            <Button
              variant="gray"
              type="button"
              className="min-w-[120px]"
              onClick={() => slotInputRefs.current[0].current.click()}
            >
              {t("Browse…")}
            </Button>

            <div
              className="w-full sm:flex-1 min-w-0 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate"
              role="status"
              aria-live="polite"
              title={stagedFiles[0]?.name || ""}
            >
              {stagedFiles[0]?.name || t("No file chosen")}
            </div>

            <div className="w-full sm:w-auto flex flex-wrap items-center justify-center sm:justify-end gap-2">
              <SaveButton
                disabled={!stagedFiles[0] || !!savingSlots[0]}
                busy={!!savingSlots[0]}
                onClick={() => handleSlotSave(0)}
              />
              <Button
                variant="red"
                type="button"
                disabled={!localPhotos[0] || savingSlots[0]}
                onClick={() => handleDelete(0)}
              >
                {savingSlots[0] ? t("Removing…") : t("Remove")}
              </Button>
            </div>
          </div>
        </ControlBar>
        {/* --- REPLACE END --- */}

        {imageErrors[0] && (
          <p className="text-xs text-red-600 mt-1">
            {t("Avatar image failed to load, showing placeholder.")}
          </p>
        )}
        {!stagedFiles[0] && (
          <p className="text-xs text-gray-600 mt-2 text-center">
            {t(
              "Tip: Choose a file to enable Save. To use an existing photo as your avatar, click “Make main” on that photo below."
            )}
          </p>
        )}
      </div>

      {/* Bulk upload (append multiple new photos) */}
      <input
        ref={bulkInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleBulkChange}
        className="hidden"
      />

      {/* --- REPLACE START: responsive bulk bar layout (no overlaps on small screens) --- */}
      <ControlBar className="mb-4 bg-gray-200 w-full flex flex-col gap-2">
        <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
          <Button
            variant="gray"
            type="button"
            className="min-w-[120px]"
            onClick={() => bulkInputRef.current?.click()}
          >
            {t("Browse…")}
          </Button>

          <div
            className="w-full sm:flex-1 min-w-0 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate"
            title={bulkFiles.length ? bulkFiles.map((f) => f.name).join(", ") : ""}
          >
            {bulkFiles.length
              ? bulkFiles.map((f) => f.name).join(", ")
              : t("No files chosen")}
          </div>

          <div className="w-full sm:w-auto flex flex-wrap items-center justify-center sm:justify-end gap-2">
            <SaveButton
              disabled={!bulkFiles.length || bulkSaving}
              busy={bulkSaving}
              onClick={handleBulkUpload}
            />
          </div>
        </div>
      </ControlBar>
      {/* --- REPLACE END --- */}

      {bulkError && <p className="text-red-600 text-sm mb-4">{bulkError}</p>}

      {/* Extra slots grid (skip idx 0 to avoid duplicate of avatar card) */}
      {/* --- REPLACE START: responsive grid columns so cards have room on small screens --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: maxSlots }).map((_, idx) => {
          if (idx === 0) return null; // ← Skip slot 0 here; it's rendered by the avatar card above
          const slotNum = idx + 1;
          const currentSrc = localPhotos[idx];
          const stagedName = stagedFiles[idx]?.name || "";
          return (
            <div
              key={slotNum}
              className="border rounded-lg p-4 flex flex-col items-center bg-white"
            >
              <div className="w-full h-48 bg-gray-200 rounded mb-2 overflow-hidden flex items-center justify-center">
                <img
                  src={resolveImg(currentSrc)}
                  alt={`Slot ${slotNum}`}
                  // --- REPLACE START: show full photo (no cropping) ---
                  className="w-full h-full object-contain bg-gray-100"
                  // --- REPLACE END ---
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER_IMAGE;
                    setImageErrors((prev) => ({ ...prev, [idx]: true }));
                  }}
                />
              </div>

              <input
                ref={slotInputRefs.current[idx]}
                type="file"
                accept="image/*"
                onChange={(e) => handleSlotChange(idx, e)}
                className="hidden"
              />

              {/* --- REPLACE START: per-slot controls stacked/wrapped to avoid overlap --- */}
              <div className="w-full">
                <ControlBar className="w-full flex flex-col gap-2">
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <Button
                      variant="gray"
                      type="button"
                      className="min-w-[120px]"
                      onClick={() => slotInputRefs.current[idx].current.click()}
                    >
                      {t("Browse…")}
                    </Button>

                    <span className="inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                      {t("Slot")} {slotNum}
                    </span>

                    <div
                      className="w-full sm:flex-1 min-w-0 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate"
                      role="status"
                      aria-live="polite"
                      title={stagedName}
                    >
                      {stagedName || t("No file chosen")}
                    </div>
                  </div>

                  <div className="w-full flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <SaveButton
                      disabled={!stagedFiles[idx] || !!savingSlots[idx]}
                      busy={!!savingSlots[idx]}
                      onClick={() => handleSlotSave(idx)}
                    />
                    <Button
                      variant="red"
                      type="button"
                      disabled={!localPhotos[idx] || savingSlots[idx]}
                      onClick={() => handleDelete(idx)}
                    >
                      {savingSlots[idx] ? t("Removing…") : t("Remove")}
                    </Button>
                    <Button
                      variant="blue"
                      type="button"
                      disabled={!localPhotos[idx] || !!savingSlots[`mk_${idx}`]}
                      onClick={() => handleMakeMain(idx)}
                    >
                      {savingSlots[`mk_${idx}`] ? t("Updating…") : t("Make main")}
                    </Button>
                  </div>
                </ControlBar>
              </div>
              {/* --- REPLACE END --- */}

              {imageErrors[idx] && (
                <p className="text-xs text-red-600 mt-1 text-center">
                  {t("Image failed to load, showing placeholder.")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {/* --- REPLACE END --- */}
    </div>
  );
}

MultiStepPhotoUploader.propTypes = {
  userId: PropTypes.string.isRequired,
  isPremium: PropTypes.bool,
  // Prefer reading from user.photos; keep prop name aligned for callers.
  photos: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.shape({ url: PropTypes.string })])
  ),
  // Optional explicit profile picture; falls back to photos[0]
  profilePicture: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ url: PropTypes.string }),
  ]),
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};
// --- REPLACE END ---

