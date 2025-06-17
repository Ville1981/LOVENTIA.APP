// client/src/api/images.js

import axios from "axios";
import { BACKEND_BASE_URL } from "../config";

/**
 * Profiilikuvan lataus
 */
export const uploadAvatar = async (userId, file) => {
  const formData = new FormData();
  formData.append("profilePhoto", file);

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Kirjaudu sisään tallentaaksesi profiilikuvan");
  }

  try {
    const res = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-avatar`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      }
    );
    return res.data.user;
  } catch (err) {
    console.error("uploadAvatar error:", err.response || err);
    const msg = err.response?.data?.error || "Avatarin tallennus epäonnistui";
    throw new Error(msg);
  }
};

/**
 * Lisäkuvien lataus (useamman kuvan bulk-lähetys)
 */
export const uploadPhotos = async (userId, filesOrFormData) => {
  let formData;
  if (filesOrFormData instanceof FormData) {
    formData = filesOrFormData;
  } else {
    const validFiles = filesOrFormData.filter((file) => file instanceof File);
    if (validFiles.length === 0) {
      throw new Error("Et valinnut kuvaa ladattavaksi.");
    }
    formData = new FormData();
    validFiles.forEach((file) => {
      formData.append("photos", file);
    });
  }

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Kirjaudu sisään tallentaaksesi lisäkuvia");
  }

  try {
    const res = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-photos`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      }
    );
    return res.data.user;
  } catch (err) {
    console.error("uploadPhotos error:", err.response || err);
    const errorMsg = err.response?.data?.error;
    if (errorMsg) {
      throw new Error(errorMsg);
    }
    throw new Error("Lisäkuvien tallennus epäonnistui");
  }
};

/**
 * Yksi kuvan vaiheittainen lähetys: crop + caption + slot
 */
export const uploadPhotoStep = async (userId, formData) => {
  // formData sisältää kentät: photo, slot, cropX, cropY, cropWidth, cropHeight, caption
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Kirjaudu sisään tallentaaksesi kuvan");
  }

  try {
    const res = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-photo-step`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      }
    );
    return res.data.user;
  } catch (err) {
    console.error("uploadPhotoStep error:", err.response || err);
    const msg = err.response?.data?.error || "Kuvan tallennus epäonnistui";
    throw new Error(msg);
  }
};

/**
 * Poistaa kuvan annetusta slotista
 */
export const deletePhotoSlot = async (userId, slot) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Kirjaudu sisään poistaaksesi kuvan");
  }

  try {
    const res = await axios.delete(
      `${BACKEND_BASE_URL}/api/users/${userId}/photos/${slot}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      }
    );
    return res.data.user;
  } catch (err) {
    console.error("deletePhotoSlot error:", err.response || err);
    const msg = err.response?.data?.error || "Kuvan poisto epäonnistui";
    throw new Error(msg);
  }
};
