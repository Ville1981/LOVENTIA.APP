// src/services/api/axiosInstance.js
// Centralized Axios instance with JWT management and automatic token refresh

import axios from 'axios';

// Internal access token; set via setAccessToken after login/refresh
let accessToken = null;

/**
 * Update the in-memory access token
 * @param {string} token - new JWT access token
 */
export function setAccessToken(token) {
  accessToken = token;
}

// Create Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/',
  headers: {
    'Content-Type': 'application/json',
  },
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
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Call refresh endpoint; assumes refreshToken stored in HttpOnly cookie
        const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newToken = res.data.accessToken;
        setAccessToken(newToken);
        // Update header and retry original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Redirect to login or propagate error
        console.error('Token refresh failed:', refreshError);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
