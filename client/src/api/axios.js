// File: client/src/api/axios.js

// --- REPLACE START: adapter that re-exports the existing axios instance + token helpers ---
import api from "../services/api/axiosInstance.js";

/**
 * Attach/remove bearer token to axios default header and localStorage.
 * This mirrors what AuthContext expects.
 */
export function attachAccessToken(token) {
  try {
    if (token) {
      // persist (keep legacy key too)
      localStorage.setItem("accessToken", token);
      localStorage.setItem("token", token);
      // set header
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
      delete api.defaults.headers.common.Authorization;
    }
    if (import.meta?.env?.DEV) {
      // eslint-disable-next-line no-console
      console.info("[api/axios] token attached:", Boolean(token));
    }
  } catch {
    /* noop */
  }
}

/**
 * Read bearer token from memory/storage.
 */
export function getAccessToken() {
  try {
    return (
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token") ||
      null
    );
  } catch {
    return null;
  }
}

export default api;
// --- REPLACE END ---
