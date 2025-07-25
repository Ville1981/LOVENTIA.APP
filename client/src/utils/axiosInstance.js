// @ts-nocheck
import axios from "axios";
import { BACKEND_BASE_URL } from "./config";

// Initialize token from localStorage
let accessToken = localStorage.getItem("token") || null;

/**
 * Update internal token and persist to localStorage.
 * @param {string|null} token
 */
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

// Determine baseURL for API requests
// Align with proxy to avoid double "/api"
// --- REPLACE START: ensure baseURL always includes /api prefix ---
const rawUrl = BACKEND_BASE_URL || import.meta.env.VITE_API_URL || "";
const baseURL = rawUrl.endsWith("/api")
  ? rawUrl
  : `${rawUrl.replace(/\/?$/, "")}/api`;
// --- REPLACE END ---

// Create Axios instance
const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Attach token and JSON headers
api.interceptors.request.use((config) => {
  const token = accessToken || localStorage.getItem("token");
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
        const { data } = await api.post("/auth/refresh");
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
