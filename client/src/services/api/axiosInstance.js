// File: client/src/services/api/axiosInstance.js
// @ts-nocheck
import axios from "axios";
import { BACKEND_BASE_URL } from "../../config"; // ← fixed path

/**
 * Internal storage for the access token.
 */
// --- REPLACE START: unify storage key to 'accessToken' ---
let accessToken = localStorage.getItem("accessToken") || null;
// --- REPLACE END ---

/**
 * Updates the internal token and persists it (or removes it) in localStorage.
 * @param {string|null} token
 */
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    // --- REPLACE START: persist under 'accessToken' key ---
    localStorage.setItem("accessToken", token);
    // --- REPLACE END ---
  } else {
    // --- REPLACE START: remove 'accessToken' when logging out ---
    localStorage.removeItem("accessToken");
    // --- REPLACE END ---
  }
};

// --- REPLACE START: build full API baseURL including '/api' ---
/**
 * Determine the baseURL for all API requests.
 * Prioritizes BACKEND_BASE_URL, then VITE_API_URL env var.
 * Strips any trailing slash, then appends '/api'.
 */
const rawUrl = BACKEND_BASE_URL || import.meta.env.VITE_API_URL || "";
const baseURL = rawUrl.replace(/\/$/, "") + "/api";
// --- REPLACE END ---

// Create Axios instance with credentials support
const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Attach token and JSON headers to every request
api.interceptors.request.use((config) => {
  const token = accessToken || localStorage.getItem("accessToken");
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  if (config.data && !(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

// Refresh token on 401 and retry original request
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
        // --- REPLACE START: call refresh endpoint with full path ---
        const { data } = await api.post("/auth/refresh");
        // --- REPLACE END ---
        setAccessToken(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("🔄 Refresh failed:", refreshError);
        setAccessToken(null);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;