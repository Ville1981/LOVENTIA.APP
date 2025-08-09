// @ts-nocheck
import axios from "axios";

// --- REPLACE START: correct import path to front-end config.js ---
import { BACKEND_BASE_URL } from "../config";
// --- REPLACE END ---

/**
 * Internal storage for the access token.
 */
// --- REPLACE START: unify storage key to 'accessToken' ---
let accessToken = localStorage.getItem("accessToken") || null;
// --- REPLACE END ---

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

// --- REPLACE START: compute baseURL with safe default '/api' and without trailing slash ---
const rawUrl =
  BACKEND_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "/api"; // ensure Vite proxy is used in dev if nothing is set
const baseURL = String(rawUrl).replace(/\/$/, "");
// --- REPLACE END ---

const api = axios.create({
  baseURL,
  withCredentials: true,
});

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

// --- REPLACE START: make refresh path baseURL-relative and avoid infinite loop ---
const REFRESH_PATH = "/auth/refresh";
// --- REPLACE END ---

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original) return Promise.reject(error);

    const requestedPath = (() => {
      try {
        const u = new URL(original.url, baseURL || window.location.origin);
        return u.pathname;
      } catch {
        return original.url || "";
      }
    })();

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !requestedPath.endsWith(REFRESH_PATH)
    ) {
      original._retry = true;
      try {
        // --- REPLACE START: call refresh endpoint WITHOUT extra '/api' (baseURL already includes it) ---
        const { data } = await api.post(REFRESH_PATH);
        // --- REPLACE END ---
        setAccessToken(data.accessToken);
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${data.accessToken}`,
        };
        return api(original);
      } catch (e) {
        console.error("🔄 Refresh failed:", e);
        setAccessToken(null);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
