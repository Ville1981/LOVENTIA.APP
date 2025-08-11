// --- REPLACE START: resilient Axios instance with refresh + credentials ---
import axios from 'axios';

/**
 * Resolve API base URL
 * Priority: VITE_API_BASE_URL -> VITE_BACKEND_URL -> window.origin guess
 * Ensures trailing '/api' and no duplicate slashes.
 */
function resolveBaseURL() {
  let fromEnv = undefined;
  try {
    // NOTE: TypeScript complained about `typeof import` checks.
    // Access `import.meta.env` directly (valid in Vite) and guard with try/catch.
    fromEnv =
      (typeof import.meta !== 'undefined' &&
        import.meta.env &&
        (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL)) ||
      undefined;
  } catch (_) {
    // ignore if not running under Vite
  }

  // Fallback guess: swap common dev port 5173/5174 -> 5000 and append '/api'
  const origin =
    (typeof window !== 'undefined' && window.location?.origin) ||
    'http://localhost:5174';
  const guessOrigin = origin.replace(/:5173|:5174/, ':5000');

  const raw = (fromEnv && String(fromEnv)) || `${guessOrigin}`;
  const cleaned = raw.replace(/\/+$/, '');
  return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`;
}

const BASE_URL = resolveBaseURL();

// Simple in-memory token store so any module can update the header.
let accessToken = null;
export function attachAccessToken(token) {
  accessToken = token || null;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
export function getAccessToken() {
  return accessToken;
}

// Single axios instance used across the app
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // allow cookie round-trips (refreshToken)
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor: ensure Authorization is present if we have a token
api.interceptors.request.use(
  (config) => {
    if (accessToken && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: try refresh once on 401
let refreshPromise = null;
async function performRefresh() {
  if (!refreshPromise) {
    // IMPORTANT: send {} instead of null to satisfy express.json(strict:true)
    refreshPromise = api
      .post('/auth/refresh', {}, { withCredentials: true })
      .then((res) => {
        const nextToken = res?.data?.accessToken;
        if (!nextToken) throw new Error('No accessToken in refresh response');
        attachAccessToken(nextToken);
        return nextToken;
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
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    if (!response || response.status !== 401 || config?._retry) {
      return Promise.reject(error);
    }
    // flag to avoid infinite loop
    config._retry = true;

    try {
      await performRefresh();
      // Re-issue the original request with updated token
      return api(config);
    } catch (refreshErr) {
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
// --- REPLACE END ---
