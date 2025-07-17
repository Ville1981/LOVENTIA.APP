// src/utils/axiosInstance.js

import axios from "axios";
import { BACKEND_BASE_URL } from "./config";

// Initialize accessToken from localStorage or null
let accessToken = localStorage.getItem("token") || null;

/**
 * Update internal accessToken variable
 * and persist to localStorage.
 */
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

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
const api = axios.create({
  baseURL,
  withCredentials: true,
});

// --- Request interceptor: add Authorization header and JSON content-type ---
api.interceptors.request.use(
  (config) => {
    const token = accessToken || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If sending JSON (not FormData), set content-type
    if (config.data && !(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response interceptor: on 401, attempt refresh and retry original request ---
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
        console.error("🔄 Refresh token failed:", refreshError);
        setAccessToken(null);
        // redirect to login
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
