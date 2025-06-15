import axios from "axios";
import { BACKEND_BASE_URL } from "../config"; // ✅ varmista, että config sisältää backend-URL:n

/**
 * ✅ Profiilikuvan lataus
 */
export const uploadAvatar = async (userId, file) => {
  const formData = new FormData();
  formData.append("profilePhoto", file);

  const token = localStorage.getItem("token");

  const res = await axios.post(
    `${BACKEND_BASE_URL}/api/users/${userId}/upload-avatar`,
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
 */
export const uploadPhotos = async (userId, files) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("photos", file);
  });

  const token = localStorage.getItem("token");

  const res = await axios.post(
    `${BACKEND_BASE_URL}/api/users/${userId}/upload-photos`,
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
