import axios from "axios";
import { BACKEND_BASE_URL } from "./config";

// Initialize token from localStorage
let accessToken = localStorage.getItem("token") || null;

/**
 * Update internal token and persist to localStorage.
 */
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

// Determine baseURL
const baseURL = BACKEND_BASE_URL
  ? `${BACKEND_BASE_URL}/api`
  : import.meta.env.VITE_API_URL || "/api";

// Create Axios instance
const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Request interceptor: attach token and JSON headers
api.interceptors.request.use((config) => {
  const token = accessToken || localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data && !(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

// Response interceptor: on 401, try refresh and retry
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
