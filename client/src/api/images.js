// --- REPLACE START: switch to unified axios instance + align endpoints with server ---
import api, { getAccessToken } from "../services/api/axiosInstance";

/**
 * IMPORTANT
 * ---------------------------------------------------------------------------
 * We ONLY use /api/users/:id/... endpoints. No /api/images/... paths remain.
 * Server responses are being unified to return a normalized user object:
 *   { user: <normalizedUser> }
 *
 * For backward compatibility during rollout, these helpers also tolerate
 * older shapes (e.g. { extraImages: [...] } or { profilePicture: "..." }).
 * Each function returns { user, extraImages, profilePicture } so existing
 * UI consumers can continue reading array/fields directly while we migrate.
 */

/* --------------------------------- helpers -------------------------------- */

function requireToken() {
  const token =
    getAccessToken() ||
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("accessToken") || localStorage.getItem("token")));
  if (!token) throw new Error("You must be logged in to perform this action.");
  return token;
}

/**
 * Normalizes various server payload shapes into a consistent result.
 * Prefers `data.user` (normalized by backend), falls back to legacy fields.
 */
function normalizeUserResponse(data) {
  const user = data?.user ?? null;

  // When the server still returns top-level arrays/fields
  const legacyExtra =
    Array.isArray(data?.extraImages) ? data.extraImages : user?.extraImages || user?.photos || [];
  const legacyAvatar =
    data?.profilePicture ?? user?.profilePicture ?? user?.profilePhoto ?? null;

  return {
    user,
    extraImages: Array.isArray(legacyExtra) ? legacyExtra : [],
    profilePicture: legacyAvatar || null,
  };
}

/* ---------------------------------- API ----------------------------------- */

/**
 * Upload avatar (single image).
 * Server: POST /api/users/:id/upload-avatar
 *
 * @param {string} userId
 * @param {File|FormData} fileOrFormData - File or FormData containing 'profilePhoto'
 * @returns {Promise<{ user: any, profilePicture: string|null }>}
 */
export const uploadAvatar = async (userId, fileOrFormData) => {
  requireToken();

  const formData =
    fileOrFormData instanceof FormData
      ? fileOrFormData
      : (() => {
          const fd = new FormData();
          fd.append("profilePhoto", fileOrFormData);
          return fd;
        })();

  try {
    const res = await api.post(`/users/${userId}/upload-avatar`, formData, {
      withCredentials: true,
    });
    const out = normalizeUserResponse(res?.data);
    return { user: out.user, profilePicture: out.profilePicture };
  } catch (err) {
    console.error("uploadAvatar error:", err?.response || err);
    const message = err?.response?.data?.error || "Failed to upload avatar.";
    throw new Error(message);
  }
};

/**
 * Bulk upload extra photos.
 * Server: POST /api/users/:id/upload-photos
 *
 * @param {string} userId
 * @param {File[]|FormData} filesOrFormData - Files or FormData with 'photos'
 * @returns {Promise<{ user: any, extraImages: string[] }>}
 */
export const uploadPhotos = async (userId, filesOrFormData) => {
  requireToken();

  const formData =
    filesOrFormData instanceof FormData
      ? filesOrFormData
      : filesOrFormData.reduce((fd, file) => {
          fd.append("photos", file);
          return fd;
        }, new FormData());

  try {
    const res = await api.post(`/users/${userId}/upload-photos`, formData, {
      withCredentials: true,
    });
    const out = normalizeUserResponse(res?.data);
    return { user: out.user, extraImages: out.extraImages };
  } catch (err) {
    console.error("uploadPhotos error:", err?.response || err);
    const message = err?.response?.data?.error || "Failed to upload photos.";
    throw new Error(message);
  }
};

/**
 * Upload a single photo step (optionally with crop).
 * Server: POST /api/users/:id/upload-photo-step
 *
 * FormData keys:
 *  - photo (File, required)
 *  - slot (number, optional)
 *  - cropX, cropY, cropWidth, cropHeight (optional)
 *  - caption (optional)
 *
 * @param {string} userId
 * @param {FormData} formData
 * @returns {Promise<{ user: any, extraImages: string[] }>}
 */
export const uploadPhotoStep = async (userId, formData) => {
  requireToken();

  // Keep FE lenient; backend normalizes and also supports "no crop" flow.
  if (formData && formData.has("cropWidth") && formData.has("cropHeight")) {
    const cw = Number.parseInt(String(formData.get("cropWidth") ?? ""), 10);
    const ch = Number.parseInt(String(formData.get("cropHeight") ?? ""), 10);
    if (Number.isFinite(cw) && Number.isFinite(ch)) {
      formData.set("cropWidth", Math.max(0, cw).toString());
      formData.set("cropHeight", Math.max(0, ch).toString());
    }
  }

  try {
    const res = await api.post(`/users/${userId}/upload-photo-step`, formData, {
      withCredentials: true,
    });
    const out = normalizeUserResponse(res?.data);
    return { user: out.user, extraImages: out.extraImages };
  } catch (err) {
    console.error("uploadPhotoStep error:", err?.response || err);
    const message = err?.response?.data?.error || "Failed to upload photo.";
    throw new Error(message);
  }
};

/**
 * Delete a photo at slot index.
 * Server: DELETE /api/users/:id/photos/:slot
 *
 * @param {string} userId
 * @param {number|string} slot
 * @returns {Promise<{ user: any, extraImages: string[] }>}
 */
export const deletePhotoSlot = async (userId, slot) => {
  requireToken();

  try {
    const res = await api.delete(`/users/${userId}/photos/${slot}`, {
      withCredentials: true,
    });
    const out = normalizeUserResponse(res?.data);
    return { user: out.user, extraImages: out.extraImages };
  } catch (err) {
    console.error("deletePhotoSlot error:", err?.response || err);
    const message = err?.response?.data?.error || "Failed to delete photo.";
    throw new Error(message);
  }
};

/**
 * (Optional helper) Remove avatar by clearing slot 0.
 * This is a thin alias around deletePhotoSlot to keep old callers working.
 *
 * @param {string} userId
 * @returns {Promise<{ user: any, profilePicture: string|null }>}
 */
export const removeAvatar = async (userId) => {
  const { user, extraImages } = await deletePhotoSlot(userId, 0);
  return { user, profilePicture: extraImages?.[0] ?? null };
};
// --- REPLACE END ---
