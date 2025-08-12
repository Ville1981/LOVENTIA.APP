// File: client/src/services/api/axiosInstance.js
// @ts-nocheck

// --- REPLACE START: resilient Axios instance with refresh + credentials ---
import axios from "axios";

/**
 * Resolve API base URL.
 * Priority: VITE_API_BASE_URL -> VITE_BACKEND_URL -> window.origin guess.
 * Ensures trailing '/api' and no duplicate slashes.
 */
function resolveBaseURL() {
  let fromEnv;
  try {
    // Works under Vite; guarded for tests/build tools
    fromEnv =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_API_BASE_URL ||
          import.meta.env.VITE_BACKEND_URL)) ||
      undefined;
  } catch {
    // ignore if not running under Vite
  }

  // Fallback guess: use current origin and map common dev ports 5173/5174 -> 5000
  const origin =
    (typeof window !== "undefined" && window.location?.origin) || "";
  const guessOrigin = origin.replace(/:5173|:5174/, ":5000");

  const raw = (fromEnv && String(fromEnv)) || guessOrigin || "";
  const cleaned = raw.replace(/\/+$/, ""); // trim trailing slashes
  const ensured = cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;

  // Normalize accidental double slashes but keep "http(s)://"
  return ensured.replace(/([^:])\/\/+/g, "$1/");
}

// Calculated once at module init; if you need to override at runtime, export a setter.
const BASE_URL = resolveBaseURL();

/**
 * In-memory access token with localStorage fallback (compat).
 * Keep both names exported so old imports keep working.
 */
let accessToken =
  (typeof localStorage !== "undefined" &&
    (localStorage.getItem("accessToken") || localStorage.getItem("token"))) ||
  null;

export function attachAccessToken(token) {
  accessToken = token || null;

  if (typeof localStorage !== "undefined") {
    if (token) {
      localStorage.setItem("accessToken", token);
      localStorage.setItem("token", token); // legacy key
    } else {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
    }
  }

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Backward/forward compatible helper names
export const setAccessToken = (t) => attachAccessToken(t);
export function getAccessToken() {
  return (
    accessToken ||
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("accessToken") || localStorage.getItem("token"))) ||
    null
  );
}

// Create the single axios instance used across the app
const api = axios.create({
  // No hardcoded localhost; env or runtime guess above
  baseURL: BASE_URL || "/api",
  withCredentials: true, // allow cookie round-trips (refresh cookie)
  headers: {
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json",
  },
});

// Ensure Authorization header for every request if we have a token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
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

    // Avoid accidental '/api/api/*' duplication if someone passes urls beginning with '/api/'
    if (
      typeof config.url === "string" &&
      config.url.startsWith("/api/") &&
      String(api.defaults.baseURL || "").endsWith("/api")
    ) {
      config.url = config.url.replace(/^\/api\//, "/");
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh logic: try once on 401 responses
let refreshPromise = null;

async function performRefresh() {
  if (!refreshPromise) {
    // IMPORTANT: send {} (not null/undefined) to satisfy express.json(strict: true)
    refreshPromise = api
      .post("/auth/refresh", {}, { withCredentials: true })
      .then((res) => {
        const next = res?.data?.accessToken;
        if (!next) throw new Error("No accessToken in refresh response");
        attachAccessToken(next);
        return next;
      })
      .catch((err) => {
        attachAccessToken(null);
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    if (!original) return Promise.reject(error);

    const status = error?.response?.status;
    if (status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Prevent infinite loops
    original._retry = true;

    try {
      await performRefresh();
      // Retrigger original request with the new token
      return api(original);
    } catch (refreshErr) {
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
// --- REPLACE END ---
