// File: client/src/api/axios.js

// --- REPLACE START: keep token for /auth/reset-password and similar auth calls ---
import axios from "axios";

/**
 * Small helper to safely parse an origin (protocol+host+port) from a URL string.
 */
function getOrigin(input) {
  try {
    const u = new URL(input, window.location?.origin || "http://localhost");
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

/**
 * Resolve API base URL.
 * Priority: VITE_API_BASE_URL -> VITE_BACKEND_URL -> runtime origin guess.
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

/**
 * Build allowlist of API origins for CORS hygiene.
 */
function buildAllowedApiOrigins() {
  const current =
    (typeof window !== "undefined" && window.location?.origin) || "";
  const envAllow =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_ALLOWED_API_ORIGINS || "")) ||
    "";

  const list = new Set(
    [current, ...envAllow.split(",")]
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => getOrigin(s))
  );
  return list;
}

// Calculated once at module init
const BASE_URL = resolveBaseURL();
const BASE_ORIGIN = getOrigin(BASE_URL);
const ALLOWED_API_ORIGINS = buildAllowedApiOrigins();

/**
 * In-memory access token with localStorage fallback.
 */
let accessToken =
  (typeof localStorage !== "undefined" &&
    (localStorage.getItem("accessToken") ||
      localStorage.getItem("token"))) ||
  null;

/**
 * Attach token to memory, storage, and axios default header.
 */
export function attachAccessToken(token) {
  const next = token || null;
  const curr =
    accessToken ||
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("accessToken") ||
        localStorage.getItem("token"))) ||
    null;

  // Guard: no change
  if (typeof next === "string" && typeof curr === "string" && next === curr) {
    return;
  }

  accessToken = next;

  if (typeof localStorage !== "undefined") {
    if (next) {
      localStorage.setItem("accessToken", next);
      localStorage.setItem("token", next); // legacy key
    } else {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
    }
  }

  if (next) {
    api.defaults.headers.common.Authorization = `Bearer ${next}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Helpers
export const setAccessToken = (t) => attachAccessToken(t);
export function getAccessToken() {
  return (
    accessToken ||
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("accessToken") ||
        localStorage.getItem("token"))) ||
    null
  );
}

/**
 * Create axios instance
 */
const api = axios.create({
  baseURL: BASE_URL || "/api",
  withCredentials: true, // allow cookie round-trips
  headers: {
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json",
  },
});

/**
 * Build safe request log string.
 */
function describeRequest(config) {
  const method = (config.method || "get").toUpperCase();
  const base = String(config.baseURL || api.defaults.baseURL || "");
  let url = String(config.url || "");
  if (url.startsWith("/api/") && base.endsWith("/api")) {
    url = url.replace(/^\/api\//, "/");
  }
  return `${method} ${base}${url}`;
}

/**
 * Detect if URL is an auth endpoint.
 * NOTE: we keep this in sync with backend's auth routes.
 */
function isAuthPath(urlLike) {
  if (!urlLike) return false;
  const u = String(urlLike).replace(/^\//, "");
  return (
    /^auth\/(login|register|refresh|forgot|reset)(\/|$)/i.test(u) ||
    /^auth\/(forgot-password|reset-password)(\/|$)/i.test(u) ||
    /^(login|register|refresh)(\/|$)/i.test(u)
  );
}

/**
 * Detect specifically password-reset endpoints where we MUST NOT drop `token`.
 */
function isPasswordResetPath(urlLike) {
  if (!urlLike) return false;
  const u = String(urlLike).replace(/^\//, "");
  return /^auth\/reset-password(\/|$)/i.test(u);
}

/**
 * Strip sensitive keys before debug.
 * NOTE: token is deliberately in this list to avoid logging it,
 * BUT we will SKIP calling this for /auth/reset-password below.
 */
function stripSensitive(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const SENSITIVE_KEYS = [
    "card",
    "cc",
    "cvc",
    "cvv",
    "exp",
    "expiry",
    "number",
    "payment_method",
    "paymentMethod",
    "payment_method_data",
    "paymentIntent",
    "metadata",
    "client_secret",
    "clientSecret",
    "token", // <— this was nuking reset-password token from normal requests
  ];
  const out = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    if (SENSITIVE_KEYS.includes(k)) continue;
    const v = obj[k];
    out[k] = typeof v === "object" ? stripSensitive(v) : v;
  }
  return out;
}

/**
 * Only send credentials to allowed origins.
 */
function shouldSendCredentialsTo(urlLike) {
  const targetOrigin = getOrigin(String(urlLike || BASE_URL));
  if (!targetOrigin) return false;
  return (
    targetOrigin ===
      ((typeof window !== "undefined" && window.location?.origin) || "") ||
    targetOrigin === BASE_ORIGIN ||
    ALLOWED_API_ORIGINS.has(targetOrigin)
  );
}

/**
 * Request interceptor
 */
api.interceptors.request.use(
  (config) => {
    // Normalize /api prefix when baseURL already ends with /api
    if (
      typeof config.url === "string" &&
      config.url.startsWith("/api/") &&
      String(api.defaults.baseURL || "").endsWith("/api")
    ) {
      config.url = config.url.replace(/^\/api\//, "/");
    }

    const absoluteURL = new URL(
      String(config.url || ""),
      String(config.baseURL || api.defaults.baseURL || BASE_URL)
    ).toString();

    const urlForCheck = String(config.url || "");
    const allowCreds = shouldSendCredentialsTo(absoluteURL);
    const isAuth = isAuthPath(urlForCheck);
    const isReset = isPasswordResetPath(urlForCheck);

    // Attach auth header only for non-auth endpoints
    if (!isAuth && allowCreds) {
      const token = getAccessToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      config.withCredentials = true;
    } else {
      // For auth endpoints we normally don't send bearer
      if (config.headers && "Authorization" in config.headers) {
        delete config.headers.Authorization;
      }
      config.withCredentials = false;
    }

    // IMPORTANT:
    // Before: we always did stripSensitive(config.data) → this removed `token`
    // Now: if this is /auth/reset-password, we KEEP the body as-is.
    if (config.data && !(config.data instanceof FormData)) {
      config.headers = {
        ...config.headers,
        "Content-Type": "application/json",
      };
      config.data = isReset ? config.data : stripSensitive(config.data);
    }

    if (config.params && typeof config.params === "object") {
      // params rarely contain token, but keep logic consistent
      config.params = isReset ? config.params : stripSensitive(config.params);
    }

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

/**
 * Refresh logic
 * Debounced via a module-scoped promise (prevents parallel refresh spam).
 * Always calls /auth/refresh (withCredentials).
 */
let refreshPromise = null;

async function performRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        if (!shouldSendCredentialsTo(BASE_URL)) {
          throw new Error("Refresh origin not allowed");
        }

        const res = await api.post(
          "/auth/refresh",
          {},
          { withCredentials: true }
        );
        const incoming =
          res?.data?.accessToken || res?.data?.token || null;

        if (!incoming) throw new Error("No accessToken in refresh response");

        const before = getAccessToken();
        if (typeof incoming === "string" && incoming === before) {
          return incoming; // token unchanged
        }

        attachAccessToken(incoming);
        return incoming;
      } catch (err) {
        attachAccessToken(null);
        throw err;
      } finally {
        refreshPromise = null; // release lock
      }
    })();
  }
  return refreshPromise;
}

/**
 * Response interceptor
 */
api.interceptors.response.use(
  (response) => {
    try {
      const method = (response.config?.method || "get").toUpperCase();
      const base = String(
        response.config?.baseURL || api.defaults.baseURL || ""
      );
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

    // --- REPLACE START: flag intro feature lock (403) for UI handling ---
    if (status === 403) {
      const data = error?.response?.data;
      if (
        data &&
        (data.feature === "intros" || data.code === "FEATURE_LOCKED")
      ) {
        error.isIntroLocked = true;
      }
    }
    // --- REPLACE END ---

    // Do not refresh for auth endpoints
    if (isAuthPath(original.url || "")) {
      return Promise.reject(error);
    }

    // Only attempt refresh once
    if (status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      await performRefresh();
      return api(original);
    } catch (refreshErr) {
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
// --- REPLACE END ---

