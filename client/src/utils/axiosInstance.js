// @ts-nocheck
import axios from "axios";
import { BACKEND_BASE_URL } from "./config";

// Initialize token from localStorage
// --- REPLACE START: unify storage key to 'accessToken' ---
let accessToken = localStorage.getItem("accessToken") || null;
// --- REPLACE END ---

/**
 * Update internal token and persist to localStorage.
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

// Determine baseURL for API requests
// Align with proxy to avoid double "/api"
// --- REPLACE START: use raw BACKEND_BASE_URL or VITE_API_URL as-is (no appended "/api") ---
const rawUrl = BACKEND_BASE_URL || import.meta.env.VITE_API_URL || "";
const baseURL = rawUrl.replace(/\/$/, "");
// --- REPLACE END ---

// Create Axios instance
const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Attach token and JSON headers
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

// Response interceptor: refresh token on 401 and retry original request
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
        const { data } = await api.post("/api/auth/refresh");
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

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed
