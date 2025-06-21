// client/src/utils/axiosInstance.js

import axios from "axios";

// Alustetaan accessToken joko localStoragesta tai nulliksi
let accessToken = localStorage.getItem("token") || null;

/**
 * Päivittää sisäisen accessToken-muuttujan
 * ja tallentaa sen localStorageen.
 * Kutsutaan esim. login-funktion jälkeen ja refresh-vastauksen jälkeen.
 */
export const setAccessToken = (token) => {
  accessToken = token;
  localStorage.setItem("token", token);
};

const api = axios.create({
  // Käytä VITE_API_URL ympäristömuuttujaa tai oletusproxya /api
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true, // lähettää sekä vastaanottaa httpOnly-cookiet
});

// --- Request interceptor: lisätään Authorization-header ---
api.interceptors.request.use(
  (config) => {
    // Haetaan tuorein token joko suljetusta closure-muuttujasta tai localStoragesta
    const token = accessToken || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response interceptor: jos 401, yritä refresh ja uudelleenlähetä alkuperäinen pyyntö ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Tarkista, että virhe on 401, ei ole vielä retry, eikä olla jo refresh-endpointissa
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      try {
        // Kutsutaan refresh-endpointia saman instanssin kautta
        const { data } = await api.post("/auth/refresh");

        // Päivitetään token sekä closureen että localStorageen
        accessToken = data.accessToken;
        setAccessToken(accessToken);

        // Lisätään uusi token alkuperäiseen pyyntöön ja toistetaan pyyntö
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("🔄 Refresh token epäonnistui:", refreshError);
        return Promise.reject(refreshError);
      }
    }

    // Kaikki muut virheet kulkevat eteenpäin
    return Promise.reject(error);
  }
);

export default api;
