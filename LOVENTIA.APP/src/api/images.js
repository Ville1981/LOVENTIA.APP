import axios from "axios";

import { BACKEND_BASE_URL } from "../config";

/**
 * Uploads a user's avatar image to the server.
 * Accepts either a File or a ready-made FormData (for crop flow).
 * @param {string} userId - The ID of the user.
 * @param {File|FormData} fileOrFormData - The image file or a FormData containing 'profilePhoto'.
 * @returns {Promise<{ profilePicture: string | null }>} The new profilePicture URL.
 * @throws {Error} When not authenticated or upload fails.
 */
export const uploadAvatar = async (userId, fileOrFormData) => {
  let formData;

  // If caller already passed FormData (e.g. crop flow), use it; otherwise wrap the File.
  if (fileOrFormData instanceof FormData) {
    formData = fileOrFormData;
  } else {
    formData = new FormData();
    formData.append("profilePhoto", fileOrFormData);
  }

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("You must be logged in to upload an avatar.");
  }

  try {
    const response = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-avatar`,
      formData,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
    return { profilePicture: response.data.profilePicture };
  } catch (err) {
    console.error("uploadAvatar error:", err.response || err);
    const message = err.response?.data?.error || "Failed to upload avatar.";
    throw new Error(message);
  }
};

/**
 * Removes a user's avatar by deleting slot 0.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<{ profilePicture: string | null }>} The cleared profilePicture value.
 * @throws {Error} When not authenticated or removal fails.
 */
export const removeAvatar = async (userId) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("You must be logged in to remove your avatar.");
  }

  try {
    const response = await axios.delete(
      `${BACKEND_BASE_URL}/api/users/${userId}/photos/0`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
    return { profilePicture: response.data.extraImages[0] || null };
  } catch (err) {
    console.error("removeAvatar error:", err.response || err);
    const message = err.response?.data?.error || "Failed to remove avatar.";
    throw new Error(message);
  }
};

/**
 * Bulk uploads extra photos for a user.
 * @param {string} userId - The ID of the user.
 * @param {File[]|FormData} filesOrFormData - Array of files or a FormData instance.
 * @returns {Promise<{ extraImages: string[] }>} The updated array of extra image URLs.
 * @throws {Error} When not authenticated or upload fails.
 */
export const uploadPhotos = async (userId, filesOrFormData) => {
  const formData =
    filesOrFormData instanceof FormData
      ? filesOrFormData
      : filesOrFormData.reduce((fd, file) => {
          fd.append("photos", file);
          return fd;
        }, new FormData());

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("You must be logged in to upload photos.");
  }

  try {
    const response = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/photos`,
      formData,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
    return { extraImages: response.data.extraImages };
  } catch (err) {
    console.error("uploadPhotos error:", err.response || err);
    const message = err.response?.data?.error || "Failed to upload photos.";
    throw new Error(message);
  }
};

/**
 * Uploads a single photo step‐wise with optional cropping and caption.
 * @param {string} userId - The ID of the user.
 * @param {FormData} formData - FormData containing photo, slot, crop params, caption.
 * @returns {Promise<{ extraImages: string[] }>} The updated array of extra image URLs.
 * @throws {Error} When not authenticated or upload fails.
 */
export const uploadPhotoStep = async (userId, formData) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("You must be logged in to upload a photo.");
  }

  // --- REPLACE START: ensure crop dimensions are valid and non-zero
  if (formData.has("cropWidth") && formData.has("cropHeight")) {
    const cw = parseInt(formData.get("cropWidth"), 10);
    const ch = parseInt(formData.get("cropHeight"), 10);
    if (!cw || !ch) {
      throw new Error("Please select a valid crop area before uploading.");
    }
    // enforce minimum of 1px if somehow zero
    formData.set("cropWidth", Math.max(cw, 1).toString());
    formData.set("cropHeight", Math.max(ch, 1).toString());
  }
  // --- REPLACE END

  try {
    const response = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/photos/upload-photo-step`,
      formData,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
    return { extraImages: response.data.extraImages };
  } catch (err) {
    console.error("uploadPhotoStep error:", err.response || err);
    const message = err.response?.data?.error || "Failed to upload photo.";
    throw new Error(message);
  }
};

/**
 * Deletes a photo from a specific slot.
 * @param {string} userId - The ID of the user.
 * @param {number|string} slot - The slot index to remove.
 * @returns {Promise<{ extraImages: string[] }>} The updated array of extra image URLs.
 * @throws {Error} When not authenticated or deletion fails.
 */
export const deletePhotoSlot = async (userId, slot) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("You must be logged in to delete a photo.");
  }

  try {
    const response = await axios.delete(
      `${BACKEND_BASE_URL}/api/users/${userId}/photos/${slot}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
    return { extraImages: response.data.extraImages };
  } catch (err) {
    console.error("deletePhotoSlot error:", err.response || err);
    const message = err.response?.data?.error || "Failed to delete photo.";
    throw new Error(message);
  }
};
