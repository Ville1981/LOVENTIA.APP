import axios from 'axios';

/**
 * Lataa käyttäjän profiilikuvan.
 * @param {string} userId - Käyttäjän ID.
 * @param {File} file - Lähetettävä tiedosto (Image/File).
 * @returns {Promise} Axios-promise.
 */
export const uploadAvatar = (userId, file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return axios.post(
    `/api/images/${userId}/upload-avatar`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' }
    }
  );
};

/**
 * Lataa käyttäjän lisäkuvat.
 * @param {string} userId - Käyttäjän ID.
 * @param {File[]} files - Lista lähetettäviä tiedostoja.
 * @returns {Promise} Axios-promise.
 */
export const uploadPhotos = (userId, files) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('photos', file);
  });
  return axios.post(
    `/api/images/${userId}/upload-photos`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' }
    }
  );
};
