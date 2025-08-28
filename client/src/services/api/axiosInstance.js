// --- REPLACE START: resilient Axios instance with refresh + credentials ---
import axios from "axios";

/**
 * Resolve API base URL.
 * Priority: VITE_API_BASE_URL -> VITE_BACKEND_URL -> runtime origin guess.
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

/**
 * Build a human-friendly URL for logs without leaking tokens.
 */
function describeRequest(config) {
  const method = (config.method || "get").toUpperCase();
  const base = String(config.baseURL || api.defaults.baseURL || "");
  let url = String(config.url || "");
  // Avoid double '/api/api/*' in logs
  if (url.startsWith("/api/") && base.endsWith("/api")) {
    url = url.replace(/^\/api\//, "/");
  }
  return `${method} ${base}${url}`;
}

/**
 * Detect if the request is an auth endpoint where we must NOT send Authorization.
 * Covers common variants: /auth/login, /auth/register, /auth/refresh, /login, /register, /refresh, /auth/forgot, /auth/reset
 */
function isAuthPath(urlLike) {
  if (!urlLike) return false;
  const u = String(urlLike).replace(/^\//, ""); // strip leading slash
  return (
    /^auth\/(login|register|refresh|forgot|reset)(\/|$)/i.test(u) ||
    /^(login|register|refresh)(\/|$)/i.test(u)
  );
}

// Ensure Authorization header for every request if we have a token,
// BUT NEVER for auth endpoints (prevents 403 on login when expired token exists).
api.interceptors.request.use(
  (config) => {
    // Avoid accidental '/api/api/*' duplication if someone passes urls beginning with '/api/'
    if (
      typeof config.url === "string" &&
      config.url.startsWith("/api/") &&
      String(api.defaults.baseURL || "").endsWith("/api")
    ) {
      config.url = config.url.replace(/^\/api\//, "/");
    }

    // Skip Authorization for auth endpoints
    const urlForCheck = String(config.url || "");
    if (!isAuthPath(urlForCheck)) {
      const token = getAccessToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`, // never log this
        };
      }
    } else {
      // Ensure we do NOT send any stale Authorization to login/register/refresh/etc
      if (config.headers && "Authorization" in config.headers) {
        delete config.headers.Authorization;
      }
    }

    // Normalize Content-Type only for plain JSON bodies
    if (config.data && !(config.data instanceof FormData)) {
      config.headers = {
        ...config.headers,
        "Content-Type": "application/json",
      };
    }

    // Lightweight request log (no headers/tokens)
    try {
      // eslint-disable-next-line no-console
      console.debug?.(`[REQ] ${describeRequest(config)}`);
    } catch {
      /* no-op */
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh logic: try once on 401 responses (but never for auth endpoints)
let refreshPromise = null;

async function performRefresh() {
  if (!refreshPromise) {
    // IMPORTANT: send {} (not null/undefined) to satisfy express.json(strict: true)
    // Try /auth/refresh first, then fall back to /refresh (root) for legacy servers.
    const tryEndpoints = ["/auth/refresh", "/refresh"];

    refreshPromise = (async () => {
      for (const ep of tryEndpoints) {
        try {
          const res = await api.post(ep, {}, { withCredentials: true });
          const next = res?.data?.accessToken || res?.data?.token;
          if (!next) throw new Error("No accessToken in refresh response");
          attachAccessToken(next);
          return next;
        } catch {
          // try next endpoint
        }
      }
      throw new Error("All refresh endpoints failed");
    })()
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
  (response) => {
    // Lightweight response log
    try {
      const method = (response.config?.method || "get").toUpperCase();
      const base = String(response.config?.baseURL || api.defaults.baseURL || "");
      const urlRaw = String(response.config?.url || "");
      const url =
        urlRaw.startsWith("/api/") && base.endsWith("/api")
          ? urlRaw.replace(/^\/api\//, "/")
          : urlRaw;
      // eslint-disable-next-line no-console
      console.debug?.(`[RES] ${response.status} ${method} ${base}${url}`);
    } catch {
      /* no-op */
    }
    return response;
  },
  async (error) => {
    const original = error?.config;
    if (!original) return Promise.reject(error);

    const status = error?.response?.status;

    // Never attempt refresh for auth endpoints to avoid loops
    if (isAuthPath(original.url || "")) {
      return Promise.reject(error);
    }

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
