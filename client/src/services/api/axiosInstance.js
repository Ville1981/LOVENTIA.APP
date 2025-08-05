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
// The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed

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

    // --- REPLACE START: prevent infinite loop on refresh failure ---
    // If the failed request was the refresh endpoint itself, reject immediately
    if (
      error.response?.status === 401 &&
      originalRequest.url?.endsWith('/auth/refresh')
    ) {
      return Promise.reject(error);
    }
    // --- REPLACE END ---

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        // --- REPLACE START: refresh token via proxy-aware api.post ---
        // Using our `api` instance so Vite’s `/api` proxy and withCredentials are applied
        const res = await api.post('/auth/refresh');
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
