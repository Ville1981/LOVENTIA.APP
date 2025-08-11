// client/src/utils/axiosInstance.js
// @ts-nocheck

// This file defines the single, canonical axios instance used by the app.
// It always points to the "/api" prefix (Vite proxy → http://localhost:5000 in dev).
// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.

// Dependencies
import axios from "axios";

// --- REPLACE START: consistent config import + base URL strategy ---
/**
 * Read BACKEND_BASE_URL from front-end config if present.
 * In local dev (localhost), always use relative "/api" so Vite proxy is used.
 * If VITE_API_BASE_URL is provided, it wins in production; otherwise default "/api".
 */
import { BACKEND_BASE_URL } from "../config";

const isLocalhost =
  typeof window !== "undefined" &&
  /^localhost$|^127\.0\.0\.1$|^::1$/.test(window.location.hostname);

const envApiBase =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  "";

let resolvedBase = "/api"; // safe default for dev
if (!isLocalhost) {
  if (envApiBase) {
    resolvedBase = String(envApiBase).replace(/\/$/, "");
  } else if (BACKEND_BASE_URL) {
    resolvedBase = String(BACKEND_BASE_URL).replace(/\/$/, "");
  }
}

const baseURL = resolvedBase;
// --- REPLACE END ---

/**
 * Access token kept in-memory and persisted in localStorage under 'accessToken'.
 * This matches all places in the app that read/write the token.
 */
// --- REPLACE START: unify storage key to 'accessToken' + export getters/setters ---
let accessToken = localStorage.getItem("accessToken") || null;

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
};

// Backward-compatible alias for older imports (e.g. attachAccessToken)
export const attachAccessToken = (token) => setAccessToken(token);

// Getter used by AuthContext bootstrap
export const getAccessToken = () => accessToken || localStorage.getItem("accessToken") || null;
// --- REPLACE END ---

/**
 * Create the single axios instance used everywhere.
 * NOTE: withCredentials=true so that the refresh cookie is sent.
 */
const api = axios.create({
  baseURL, // => "/api" in dev
  withCredentials: true,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
});

/**
 * Request interceptor:
 * - Attach Authorization header if access token exists.
 * - Set JSON Content-Type for plain objects.
 * - Guard against accidental double "/api/api/*" when someone passes "/api/*" to url.
 */
api.interceptors.request.use((config) => {
  const token = accessToken || localStorage.getItem("accessToken");

  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  // Normalize Content-Type only for plain JSON bodies
  if (config.data && !(config.data instanceof FormData)) {
    config.headers = {
      ...config.headers,
      "Content-Type": "application/json",
    };
  }

  // --- REPLACE START: avoid accidental "/api/api/*" duplication ---
  if (typeof config.url === "string" && config.url.startsWith("/api/")) {
    // If someone already included "/api", drop the leading segment
    config.url = config.url.replace(/^\/api\//, "/");
  }
  // --- REPLACE END ---

  return config;
});

/**
 * Response interceptor:
 * - On 401, try one-time silent refresh (POST /api/auth/refresh **with {} body**) and retry the original request.
 * - Prevent infinite loop by skipping refresh if the failing call is already /auth/refresh.
 */
// --- REPLACE START: make refresh path baseURL-relative and avoid infinite loop ---
const REFRESH_PATH = "/auth/refresh";
// --- REPLACE END ---

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    if (!original) return Promise.reject(error);

    // Extract pathname of the original request for loop guard
    const requestedPath = (() => {
      try {
        const u = new URL(original.url, baseURL || window.location.origin);
        return u.pathname || "";
      } catch {
        return typeof original.url === "string" ? original.url : "";
      }
    })();

    const status = error?.response?.status;

    if (
      status === 401 &&
      !original._retry &&
      !requestedPath.endsWith(REFRESH_PATH)
    ) {
      original._retry = true;
      try {
        // IMPORTANT: send {} (not undefined/null) to avoid "Unexpected token n" from body-parser strict mode
        const { data } = await api.post(REFRESH_PATH, {});
        // Expected response: { accessToken: string }
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
          original.headers = {
            ...original.headers,
            Authorization: `Bearer ${data.accessToken}`,
          };
        } else {
          throw new Error("No accessToken returned by refresh endpoint");
        }
        return api(original);
      } catch (refreshErr) {
        console.error("🔄 Refresh failed:", refreshErr);
        setAccessToken(null);
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
