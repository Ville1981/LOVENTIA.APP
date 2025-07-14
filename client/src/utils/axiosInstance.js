import axios from "axios";
import { BACKEND_BASE_URL } from "./config";

// Alustetaan accessToken joko localStoragesta tai nulliksi
let accessToken = localStorage.getItem("token") || null;

/**
 * Päivittää sisäisen accessToken-muuttujan
 * ja tallentaa sen localStorageen.
 * Kutsutaan esim. login-funktion jälkeen ja refresh-vastauksen jälkeen.
 */
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

// Määritetään Axios-instanssin baseURL
const baseURL = (() => {
  if (BACKEND_BASE_URL) {
    return `${BACKEND_BASE_URL}/api`;
  }
  // Vite-proxyn tai ympäristömuuttujan kautta
  return import.meta.env.VITE_API_URL || "/api";
})();

// Luo Axios-instanssi
const api = axios.create({
  baseURL,
  withCredentials: true,
});

// --- Request interceptor: lisätään Authorization-header ja Content-Type ----------------
api.interceptors.request.use(
  (config) => {
    // Lisätään Bearer-token
    const token = accessToken || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Aseta Content-Type oletuksena JSON:ille, mutta FormData:lle annetaan axiosin hoitaa se
    if (config.data && !(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response interceptor: jos 401, yritä refresh ja uudelleenlähetä alkuperäinen pyyntö ----
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      try {
        const { data } = await api.post("/auth/refresh");
        setAccessToken(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("🔄 Refresh-token epäonnistui:", refreshError);
        setAccessToken(null);
        // Uudelleenohjaa login-sivulle
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
