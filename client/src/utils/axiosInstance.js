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
    fromEnv =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_API_BASE_URL ||
          import.meta.env.VITE_BACKEND_URL)) ||
      undefined;
  } catch {
    // ignore if not running under Vite
  }

  // Fallback guess: swap common dev port 5173/5174 → 5000 and append '/api'
  const origin =
    (typeof window !== "undefined" && window.location?.origin) ||
    "http://localhost:5174";
  const guessOrigin = origin.replace(/:5173|:5174/, ":5000");

  const raw = (fromEnv && String(fromEnv)) || `${guessOrigin}`;
  const cleaned = raw.replace(/\/+$/, "");
  const ensured = cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
  return ensured.replace(/\/{2,}/g, "/").replace(/^http(s?):\//, "http$1://");
}

const BASE_URL = resolveBaseURL();

/**
 * In-memory access token with localStorage fallback (compat).
 * Keep both names exported so old imports keep working.
 */
let accessToken =
  localStorage.getItem("accessToken") || localStorage.getItem("token") || null;

export function attachAccessToken(token) {
  accessToken = token || null;

  // Persist for hard refresh compatibility
  if (token) {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("token", token); // legacy key
  } else {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
  }

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Backward/forward compatible names
export const setAccessToken = (t) => attachAccessToken(t);
export function getAccessToken() {
  return (
    accessToken ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    null
  );
}

// Create the single axios instance used across the app
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // allow cookie round-trips (refresh cookie)
  headers: {
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json",
  },
});

// Ensure Authorization header for every request if we have a token
api.interceptors.request.use(
  (config) => {
    const token =
      accessToken ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token");

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

    // Avoid accidental '/api/api/*' duplication
    if (typeof config.url === "string" && config.url.startsWith("/api/")) {
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
      // Optional: redirect to login here if desired
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
// --- REPLACE END ---
