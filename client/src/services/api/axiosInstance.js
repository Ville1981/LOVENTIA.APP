// client/src/services/api/axiosInstance.js

// Centralized Axios instance with JWT management and automatic token refresh

import axios from 'axios';

// Internal in-memory access token; set via setAccessToken after login/refresh
let accessToken = null;

/**
 * Update the in-memory access token
 * @param {string} token - new JWT access token
 */
export function setAccessToken(token) {
  accessToken = token;
}

// Determine baseURL: in dev, always use Vite proxy at "/api"; in prod use configured URL
// --- REPLACE START: use explicit DEV check for baseURL ---
const baseURL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL || '/api');
// --- REPLACE END ---

// Create Axios instance
const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // include cookies for refresh/logout
});

// Request interceptor: attach Authorization header
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401, attempt to refresh token and retry original request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        // --- REPLACE START: refresh token via determined baseURL ---
        const refreshUrl = `${baseURL}/auth/refresh`;
        const res = await axios.post(
          refreshUrl,
          {},
          { withCredentials: true }
        );
        // --- REPLACE END ---

        const newToken = res.data.accessToken;
        setAccessToken(newToken);

        // Update header and retry original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
