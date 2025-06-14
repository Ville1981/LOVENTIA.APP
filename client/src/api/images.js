// client/src/api/images.js

import axios from "axios";

/**
 * ✅ Profiilikuvan lataus
 * @param {string} userId - Käyttäjän ID
 * @param {File} file - Lähetettävä profiilikuva
 * @returns {Promise<Object>} päivitetty user
 */
export const uploadAvatar = async (userId, file) => {
  const formData = new FormData();
  formData.append("profilePhoto", file);

  const token = localStorage.getItem("token");

  const res = await axios.post(
    `/api/users/${userId}/upload-avatar`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data.user;
};

/**
 * ✅ Lisäkuvien lataus
 * @param {string} userId - Käyttäjän ID
 * @param {File[]} files - Lista lähetettäviä kuvia
 * @returns {Promise<Object>} päivitetty user
 */
export const uploadPhotos = async (userId, files) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("photos", file);
  });

  const token = localStorage.getItem("token");

  const res = await axios.post(
    `/api/users/${userId}/upload-photos`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data.user;
};
