// client/src/utils/axiosInstance.js

import axios from "axios";

// Alustetaan accessToken joko localStoragesta tai nulliksi
let accessToken = localStorage.getItem("token") || null;

/**
 * Päivittää sisäisen accessToken-muuttujan,
 * kutsutaan esim. login-funktion jälkeen ja refresh-vastauksen jälkeen.
 */
export const setAccessToken = (token) => {
  accessToken = token;
};

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true, // lähettää sekä vastaanottaa httpOnly-cookiet
});

// --- Request interceptor: lisätään Authorization-header ----------------------------------------------------------------------------
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

// --- Response interceptor: jos 401, yritä refresh ja uudelleenlähetä alkuperäinen pyyntö ------------------------------------------
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
        // Kutsutaan refresh-endpointia saman instanssin kautta,
        // jolloin baseURL + withCredentials hoituu automaattisesti
        const { data } = await api.post("/auth/refresh");

        // Päivitetään sekä closure-muuttuja että localStorage
        accessToken = data.accessToken;
        setAccessToken(accessToken);
        localStorage.setItem("token", accessToken);

        // Lisätään uusi token alkuperäiseen pyyntöön ja toistetaan se
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("🔄 Refresh token epäonnistui:", refreshError);
        // Palauta virhe eteenpäin, jotta konteksti/komponentti käsittelee uloskirjautumisen
        return Promise.reject(refreshError);
      }
    }

    // Muut virheet kulkevat suoraan eteenpäin
    return Promise.reject(error);
  }
);

export default api;
