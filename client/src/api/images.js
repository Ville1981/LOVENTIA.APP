import axios from "axios";
import { BACKEND_BASE_URL } from "../config";

/**
 * Profiilikuvan lataus
 */
export const uploadAvatar = async (userId, file) => {
  const formData = new FormData();
  formData.append("profilePhoto", file);

  const token = localStorage.getItem("token");
  try {
    const res = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-avatar`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          // Axios hoitaa Content-Type rajapinnan automaattisesti
        },
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
 * Lisäkuvien lataus
 */
export const uploadPhotos = async (userId, files) => {
  const formData = new FormData();
  files
    .filter((file) => file instanceof File)
    .forEach((file) => {
      formData.append("photos", file);
    });

  const token = localStorage.getItem("token");
  try {
    const res = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-photos`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          // Axios hoitaa Content-Type rajapinnan automaattisesti
        },
      }
    );
    return res.data.user;
  } catch (err) {
    console.error("uploadPhotos error:", err.response || err);
    const msg = err.response?.data?.error || "Lisäkuvien tallennus epäonnistui";
    throw new Error(msg);
  }
};
