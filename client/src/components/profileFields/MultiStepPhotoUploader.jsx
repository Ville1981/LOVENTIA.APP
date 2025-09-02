// PATH: client/src/components/profileFields/MultiStepPhotoUploader.jsx

// --- REPLACE START: add "Make main" (set avatar from existing), improve Save disabled UX, skip slot 0 in grid ---
import PropTypes from "prop-types";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import api from "../../services/api/axiosInstance";
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from "../../config";
import Button from "../ui/Button";
import ControlBar from "../ui/ControlBar";

/**
 * Normalize Windows backslashes (\) → forward slash (/)
 * and make sure it starts with a single leading slash.
 */
const normalizePath = (p = "") =>
  "/" + String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");

/**
 * Normalize user payload from backend to a stable shape the UI expects.
 * Guarantees:
 *  - paths have a single leading '/'
 *  - user.photos === user.extraImages (alias)
 *  - profile picture available as user.profilePicture (fallback profilePhoto)
 */
function normalizeUserOut(u) {
  if (!u || typeof u !== "object") return null;
  const copy = { ...u };

  // Normalize profile picture alias
  copy.profilePicture = copy.profilePicture || copy.profilePhoto || null;

  // Normalize photos / extraImages alias
  const rawList =
    Array.isArray(copy.photos) && copy.photos.length
      ? copy.photos
      : Array.isArray(copy.extraImages)
      ? copy.extraImages
      : [];

  const normList = rawList.map((s) => (s ? normalizePath(String(s)) : null));
  copy.photos = normList;
  copy.extraImages = normList;

  // Ensure profile picture is a normalized path if present
  if (copy.profilePicture) {
    copy.profilePicture = normalizePath(String(copy.profilePicture));
  } else if (normList[0]) {
    copy.profilePicture = normList[0];
  }

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
 */
function resolveImg(srcLike, fallback = PLACEHOLDER_IMAGE) {
  if (!srcLike) return fallback;
  const s = String(srcLike);
  if (/^https?:\/\//i.test(s)) return s;
  return `${BACKEND_BASE_URL}${normalizePath(s)}`;
}

/**
 * MultiStepPhotoUploader
 * -----------------------------------------------------------------------------
 * This version adds:
 *  - Clear disabled state for Save (when no file selected) + helper text.
 *  - "Make main" button per existing photo to set avatar without uploading.
 *  - Skip rendering slot 0 inside the grid (we already have a dedicated avatar card).
 *  - Keep prior functionality and length; comments in English.
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
    Array.from({ length: maxSlots }, (_, i) => photos[i] || null)
  );
  const [avatar, setAvatar] = useState(initialProfilePicture || photos[0] || null);

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
    const nextPhotos = Array.from({ length: maxSlots }, (_, i) => photos[i] || null);
    if (photosChanged(localPhotos, nextPhotos)) {
      setLocalPhotos(nextPhotos);
    }
    const nextAvatar = initialProfilePicture || photos[0] || null;
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
    if (!list.length || fromIndex == null || fromIndex < 0 || fromIndex >= list.length) {
      throw new Error("Invalid source index for Make main");
    }

    // Move selected to front (slot 0 becomes avatar)
    const picked = list[fromIndex];
    const reordered = [picked, ...list.filter((_, i) => i !== fromIndex)];

    // 1) Reorder endpoint (preferred if exists)
    try {
      const res = await api.put(`/users/${encodeURIComponent(uid)}/photos/reorder`, {
        order: reordered,
      });
      const user = normalizeUserOut(res?.data?.user || res?.data || null);
      if (user) return user;
    } catch (_) {
      // continue to option 2
    }

    // 2) Explicit set-avatar endpoint (if present)
    try {
      const payload = { path: picked, index: fromIndex };
      const res = await api.post(`/users/${encodeURIComponent(uid)}/set-avatar`, payload);
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

      // ✅ Pass normalized user to parent
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
   */
  const handleMakeMain = async (idx) => {
    // idx here refers to the index within localPhotos (grid index).
    // Note: We skip rendering idx=0 inside the grid; avatar card covers slot 0.
    if (savingSlots[`mk_${idx}`]) return;

    try {
      setSavingSlots((m) => ({ ...m, [`mk_${idx}`]: true }));
      const list = localPhotos.filter(Boolean);
      const fromIndex = idx; // because localPhotos matches server order

      const user = await apiSetAvatarFromExisting(userId, list, fromIndex);

      const updatedPhotos = Array.isArray(user?.photos) ? user.photos : [];
      if (photosChanged(localPhotos, updatedPhotos)) {
        setLocalPhotos(
          Array.from({ length: maxSlots }, (_, i) => updatedPhotos[i] || null)
        );
      }
      const nextAvatar = user?.profilePicture || updatedPhotos[0] || null;
      if (avatar !== nextAvatar) setAvatar(nextAvatar);

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
          onError={(e) => (e.currentTarget.src = PLACEHOLDER_IMAGE)}
        />
        <input
          ref={slotInputRefs.current[0]}
          type="file"
          accept="image/*"
          onChange={(e) => handleSlotChange(0, e)}
          className="hidden"
        />
        <ControlBar>
          <Button
            variant="gray"
            type="button"
            className="min-w-[120px]"
            onClick={() => slotInputRefs.current[0].current.click()}
          >
            {t("Browse…")}
          </Button>
          <div
            className="flex-1 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate"
            role="status"
            aria-live="polite"
          >
            {stagedFiles[0]?.name || t("No files chosen")}
          </div>
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
        </ControlBar>
        {!stagedFiles[0] && (
          <p className="text-xs text-gray-600 mt-2">
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
      <ControlBar className="mb-4 bg-gray-200">
        <Button
          variant="gray"
          type="button"
          className="min-w-[120px]"
          onClick={() => bulkInputRef.current?.click()}
        >
          {t("Browse…")}
        </Button>
        <div className="flex-1 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate">
          {bulkFiles.length
            ? bulkFiles.map((f) => f.name).join(", ")
            : t("No files chosen")}
        </div>
        <SaveButton
          disabled={!bulkFiles.length || bulkSaving}
          busy={bulkSaving}
          onClick={handleBulkUpload}
        />
      </ControlBar>
      {bulkError && <p className="text-red-600 text-sm mb-4">{bulkError}</p>}

      {/* Extra slots grid (skip idx 0 to avoid duplicate of avatar card) */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: maxSlots }).map((_, idx) => {
          if (idx === 0) return null; // ← Skip slot 0 here; it's rendered by the avatar card above
          const slotNum = idx + 1;
          const currentSrc = localPhotos[idx];
          return (
            <div
              key={slotNum}
              className="border rounded-lg p-4 flex flex-col items-center bg-white"
            >
              <div className="w-full h-48 bg-gray-200 rounded mb-2 overflow-hidden flex items-center justify-center">
                <img
                  src={resolveImg(currentSrc)}
                  alt={`Slot ${slotNum}`}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.src = PLACEHOLDER_IMAGE)}
                />
              </div>
              <input
                ref={slotInputRefs.current[idx]}
                type="file"
                accept="image/*"
                onChange={(e) => handleSlotChange(idx, e)}
                className="hidden"
              />
              <ControlBar>
                <Button
                  variant="gray"
                  type="button"
                  className="min-w-[120px]"
                  onClick={() => slotInputRefs.current[idx].current.click()}
                >
                  {t("Browse…")}
                </Button>
                <span className="bg-blue-200 text-white px-2 py-1 rounded text-sm">
                  {t("Slot")} {slotNum}
                </span>
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
              </ControlBar>
            </div>
          );
        })}
      </div>
    </div>
  );
}

MultiStepPhotoUploader.propTypes = {
  userId: PropTypes.string.isRequired,
  isPremium: PropTypes.bool,
  // Prefer reading from user.photos; keep prop name aligned for callers.
  photos: PropTypes.arrayOf(PropTypes.string),
  // Optional explicit profile picture; falls back to photos[0]
  profilePicture: PropTypes.string,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};
// --- REPLACE END ---
