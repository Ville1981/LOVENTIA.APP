// --- REPLACE START: resilient Axios instance with refresh + credentials (adds "token unchanged" guard) ---
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

/**
 * Build allowlist of API origins for CORS hygiene.
 * NOTE: Client cannot enforce CORS, that's server-side. We still make sure we don't
 *       send credentials/Authorization to a non-allowlisted origin by accident.
 */
function buildAllowedApiOrigins() {
  const current = (typeof window !== "undefined" && window.location?.origin) || "";
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

// Calculated once at module init; if you need to override at runtime, export a setter.
const BASE_URL = resolveBaseURL();
const BASE_ORIGIN = getOrigin(BASE_URL);
const ALLOWED_API_ORIGINS = buildAllowedApiOrigins();

/**
 * In-memory access token with localStorage fallback (compat).
 * Keep both names exported so old imports keep working.
 */
let accessToken =
  (typeof localStorage !== "undefined" &&
    (localStorage.getItem("accessToken") || localStorage.getItem("token"))) ||
  null;

/**
 * Attach token to memory, storage, and axios default header.
 * IMPORTANT: includes a "token unchanged" guard to avoid unnecessary state churn.
 */
export function attachAccessToken(token) {
  // --- Token unchanged guard: if same value as current, do nothing (prevents re-render loops) ---
  const next = token || null;
  const curr =
    accessToken ||
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("accessToken") || localStorage.getItem("token"))) ||
    null;

  // If both are strings and equal, skip writes & header mutations
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
    // Set default Authorization only once here; requests can still override per-call
    api.defaults.headers.common.Authorization = `Bearer ${next}`;
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
 * Build a human-friendly URL for logs without leaking tokens or sensitive payloads.
 * We only log method + URL. We never log headers or request/response bodies.
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

/**
 * Very light heuristic to detect sensitive keys in either request data or params.
 * We DON'T log bodies at all, but this lets us strip accidental card-related metadata if present.
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
    "token",
  ];
  const out = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    if (SENSITIVE_KEYS.includes(k)) {
      // Drop entirely (client should never echo these to logs)
      // eslint-disable-next-line no-continue
      continue;
    }
    const v = obj[k];
    out[k] = typeof v === "object" ? stripSensitive(v) : v;
  }
  return out;
}

/**
 * Ensure outgoing requests only send credentials/Authorization to allowed API origins.
 * This is a client-side hygiene layer; the *real* CORS enforcement is server-side.
 */
function shouldSendCredentialsTo(urlLike) {
  const targetOrigin = getOrigin(String(urlLike || BASE_URL));
  if (!targetOrigin) return false;
  // Allow same-origin and anything explicitly allowlisted via VITE_ALLOWED_API_ORIGINS
  return (
    targetOrigin === ((typeof window !== "undefined" && window.location?.origin) || "") ||
    targetOrigin === BASE_ORIGIN ||
    ALLOWED_API_ORIGINS.has(targetOrigin)
  );
}

// Ensure Authorization header for every request if we have a token,
// BUT NEVER for auth endpoints (prevents 403 on login when expired token exists)
// AND NEVER send credentials to non-allowlisted origins.
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

    // Compute absolute target for CORS hygiene
    const absoluteURL = new URL(
      String(config.url || ""),
      String(config.baseURL || api.defaults.baseURL || BASE_URL)
    ).toString();

    // Skip Authorization for auth endpoints
    const urlForCheck = String(config.url || "");
    const allowCreds = shouldSendCredentialsTo(absoluteURL);

    if (!isAuthPath(urlForCheck) && allowCreds) {
      const token = getAccessToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`, // never log this
        };
      }
      config.withCredentials = true;
    } else {
      // Ensure we do NOT send any stale Authorization or cookies
      if (config.headers && "Authorization" in config.headers) {
        delete config.headers.Authorization;
      }
      config.withCredentials = false;
    }

    // Normalize Content-Type only for plain JSON bodies
    if (config.data && !(config.data instanceof FormData)) {
      config.headers = {
        ...config.headers,
        "Content-Type": "application/json",
      };
      // As an extra safety, strip known sensitive keys before *any* potential debug tooling
      // (we are not logging config.data, but some dev tools could)
      config.data = stripSensitive(config.data);
    }
    // Also scrub params (again, we don't log them, but be safe)
    if (config.params && typeof config.params === "object") {
      config.params = stripSensitive(config.params);
    }

    // Lightweight request log (no headers/tokens/body)
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
          // Only send cookie to our own/allowlisted origins
          if (!shouldSendCredentialsTo(BASE_URL)) {
            throw new Error("Refresh origin not allowed");
          }
          const res = await api.post(ep, {}, { withCredentials: true });
          const incoming =
            res?.data?.accessToken || res?.data?.token || null;

          if (!incoming) throw new Error("No accessToken in refresh response");

          // --- Token unchanged guard on refresh: only update if different ---
          const before = getAccessToken();
          if (typeof incoming === "string" && incoming === before) {
            // Token is identical; do not re-attach to avoid re-render churn
            return incoming;
          }

          attachAccessToken(incoming);
          return incoming;
        } catch {
          // try next endpoint
        }
      }
      throw new Error("All refresh endpoints failed");
    })()
      .catch((err) => {
        // Clear token on hard refresh failure
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
    // Lightweight response log (status + URL only)
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
      // Retrigger original request with the (possibly) new token
      return api(original);
    } catch (refreshErr) {
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
// --- REPLACE END ---
