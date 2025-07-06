// src/api/images.js

import axios from "axios";
import { BACKEND_BASE_URL } from "../config";

/**
 * Profiilikuvan lataus:
 * 1) Lähetä kuva endpointiin /api/users/:userId/upload-avatar
 * 2) Hae takaisin koko käyttäjädata endpointista /api/users/:userId
 */
export const uploadAvatar = async (userId, file) => {
  const formData = new FormData();
  formData.append("profilePhoto", file);

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Kirjaudu sisään tallentaaksesi profiilikuvan");
  }

  try {
    // 1) Lähetä profiilikuva
    await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-avatar`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          // Content-Type jätetty pois, axios hoitaa rajanumerot automaattisesti
        },
        withCredentials: true,
      }
    );

    // 2) Hae päivitetty käyttäjädata (tässä mukana myös profilePicture + extraImages)
    const resUser = await axios.get(
      `${BACKEND_BASE_URL}/api/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );

    return resUser.data.user || resUser.data;
  } catch (err) {
    console.error("uploadAvatar error:", err.response || err);
    const msg = err.response?.data?.error || "Avatarin tallennus epäonnistui";
    throw new Error(msg);
  }
};

/**
 * Lisäkuvien lataus (bulk-upload):
 * Hakee jälkikäteen kokonaisen käyttäjädatan samasta /api/users/:userId
 */
export const uploadPhotos = async (userId, filesOrFormData) => {
  if (!userId || typeof userId !== "string") {
    throw new Error("Virheellinen käyttäjätunnus kuvan latauksessa");
  }

  const formData =
    filesOrFormData instanceof FormData
      ? filesOrFormData
      : (() => {
          const fd = new FormData();
          filesOrFormData
            .filter((f) => f instanceof File)
            .forEach((file) => fd.append("photos", file));
          return fd;
        })();

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Kirjaudu sisään tallentaaksesi lisäkuvia");
  }

  try {
    await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-photos`,
      formData,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );

    const resUser = await axios.get(
      `${BACKEND_BASE_URL}/api/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
    return resUser.data.user || resUser.data;
  } catch (err) {
    console.error("uploadPhotos error:", err.response || err);
    const errorMsg = err.response?.data?.error || "Lisäkuvien tallennus epäonnistui";
    throw new Error(errorMsg);
  }
};

/**
 * Vaiheittainen yksittäisen kuvan lataus (crop+caption+slot):
 * Palauttaa aina koko käyttäjädatan.
 */
export const uploadPhotoStep = async (userId, formData) => {
  if (!userId || typeof userId !== "string") {
    throw new Error("Virheellinen käyttäjätunnus kuvavaiheessa");
  }
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Kirjaudu sisään tallentaaksesi kuvan");
  }

  try {
    await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-photo-step`,
      formData,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );

    const resUser = await axios.get(
      `${BACKEND_BASE_URL}/api/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
    return resUser.data.user || resUser.data;
  } catch (err) {
    console.error("uploadPhotoStep error:", err.response || err);
    const msg = err.response?.data?.error || "Kuvan tallennus epäonnistui";
    throw new Error(msg);
  }
};

/**
 * Kuvan poisto tietyltä slotilta:
 * Poista, ja hae sen jälkeen aina koko käyttäjädata uudelleen.
 */
export const deletePhotoSlot = async (userId, slot) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Kirjaudu sisään poistaaksesi kuvan");
  }

  try {
    await axios.delete(
      `${BACKEND_BASE_URL}/api/users/${userId}/photos/${slot}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );

    const resUser = await axios.get(
      `${BACKEND_BASE_URL}/api/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
    return resUser.data.user || resUser.data;
  } catch (err) {
    console.error("deletePhotoSlot error:", err.response || err);
    const msg = err.response?.data?.error || "Kuvan poisto epäonnistui";
    throw new Error(msg);
  }
};
