<<<<<<< HEAD
// src/utils/axiosInstance.js

import axios from "axios";
import { BACKEND_BASE_URL } from "./config";

// Initialize accessToken from localStorage or null
let accessToken = localStorage.getItem("token") || null;

/**
 * Update internal accessToken variable
 * and persist to localStorage.
=======
import axios from "axios";
import { BACKEND_BASE_URL } from "./config";

// Alustetaan accessToken joko localStoragesta tai nulliksi
let accessToken = localStorage.getItem("token") || null;

/**
 * Päivittää sisäisen accessToken-muuttujan
 * ja tallentaa sen localStorageen.
 * Kutsutaan esim. login-funktion jälkeen ja refresh-vastauksen jälkeen.
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
 */
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

<<<<<<< HEAD
// Determine Axios baseURL.
// Prefer VITE_API_BASE_URL (set in /client/.env), then config fallback, then "/api".
const baseURL = (() => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (BACKEND_BASE_URL) {
    // if BACKEND_BASE_URL from config.js points to e.g. http://localhost:5000
    return `${BACKEND_BASE_URL}/api`;
  }
  // default proxy in Vite: client → /api
  return "/api";
})();

// Create Axios instance
=======
// Määritetään Axios-instanssin baseURL
const baseURL = (() => {
  if (BACKEND_BASE_URL) {
    return `${BACKEND_BASE_URL}/api`;
  }
  // Vite-proxyn tai ympäristömuuttujan kautta
  return import.meta.env.VITE_API_URL || "/api";
})();

// Luo Axios-instanssi
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
const api = axios.create({
  baseURL,
  withCredentials: true,
});

<<<<<<< HEAD
// --- Request interceptor: add Authorization header and JSON content-type ---
api.interceptors.request.use(
  (config) => {
=======
// --- Request interceptor: lisätään Authorization-header ja Content-Type ----------------
api.interceptors.request.use(
  (config) => {
    // Lisätään Bearer-token
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    const token = accessToken || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
<<<<<<< HEAD
    // If sending JSON (not FormData), set content-type
=======
    // Aseta Content-Type oletuksena JSON:ille, mutta FormData:lle annetaan axiosin hoitaa se
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    if (config.data && !(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  },
  (error) => Promise.reject(error)
);

<<<<<<< HEAD
// --- Response interceptor: on 401, attempt refresh and retry original request ---
=======
// --- Response interceptor: jos 401, yritä refresh ja uudelleenlähetä alkuperäinen pyyntö ----
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
<<<<<<< HEAD
=======

>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
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
<<<<<<< HEAD
        console.error("🔄 Refresh token failed:", refreshError);
        setAccessToken(null);
        // redirect to login
=======
        console.error("🔄 Refresh-token epäonnistui:", refreshError);
        setAccessToken(null);
        // Uudelleenohjaa login-sivulle
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
<<<<<<< HEAD
=======

>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    return Promise.reject(error);
  }
);

export default api;
