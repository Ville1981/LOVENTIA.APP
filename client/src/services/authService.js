// --- REPLACE START: import unified axios instance ---
import api, { setAccessToken } from "./api/axiosInstance";
// --- REPLACE END ---

/**
 * Auth service centralizes auth-related API calls, so the rest of the app
 * doesn't need to know exact endpoints or token handling details.
 * All endpoints are relative because the axios instance already has baseURL.
 * Keep the surface area stable to avoid breaking existing callers.
 */
const authService = {
  /**
   * Log in with credentials and persist the returned access token.
   * NOTE:
   *   Backend working endpoint (tested from PowerShell) is:
   *     POST /api/users/login
   *   → our axios instance already prefixes `/api`, so here we must call `/users/login`.
   *   This was previously `/auth/login` which returned 404.
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ user: any, accessToken: string }>}
   */
  login: async function (credentials) {
    // --- REPLACE START: login endpoint must use our working server route ---
    // was: await api.post("/auth/login", credentials);
    const response = await api.post("/users/login", credentials);
    // --- REPLACE END ---
    const { accessToken, user } = response.data || {};
    if (accessToken) setAccessToken(accessToken);
    return { user, accessToken };
  },

  /**
   * Registration helper.
   * Accepts { username, email, password } and returns server response.
   * Throws axios error with response.message/error if server provides them.
   * @param {{ username:string, email:string, password:string }} payload
   * @returns {Promise<any>}
   */
  register: async function (payload) {
    // --- REPLACE START: call unified auth register endpoint ---
    // NOTE: If later we confirm that server exposes only /api/users/register,
    // we can switch this to "/users/register", but for now we keep it as is.
    const response = await api.post("/auth/register", payload);
    return response.data;
    // --- REPLACE END ---
  },

  /**
   * Fetch the current user profile (requires valid access token).
   * @returns {Promise<any>} user object (server returns { user: {...} })
   */
  me: async function () {
    // --- REPLACE START: keep the same shape the server returns ---
    const response = await api.get("/auth/me");
    return response.data?.user || null;
    // --- REPLACE END ---
  },

  /**
   * Logout clears the refresh cookie server-side and our local access token.
   * Always clears local token even if the server call fails.
   */
  logout: async function () {
    try {
      // --- REPLACE START: logout endpoint must use our `api` instance ---
      await api.post("/auth/logout", {}); // send {} to avoid strict JSON null issue
      // --- REPLACE END ---
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      setAccessToken(null);
    }
  },

  /**
   * Some apps expose a revoke endpoint; here it maps to logout for simplicity.
   * Kept for backward compatibility with callers that expect revoke().
   */
  revokeToken: async function () {
    try {
      // --- REPLACE START: revoke endpoint is same as logout ---
      await api.post("/auth/logout", {}); // keep same behavior
      // --- REPLACE END ---
    } catch (err) {
      console.error("Error revoking token:", err);
    } finally {
      setAccessToken(null);
    }
  },

  /**
   * Request a new access token via refresh cookie.
   * Persists the new token if present and returns it to the caller.
   * @returns {Promise<string|null>}
   */
  refresh: async function () {
    // --- REPLACE START: refresh endpoint must use {} body to avoid body-parser strict errors ---
    const res = await api.post("/auth/refresh", {});
    // --- REPLACE END ---
    const newToken = res?.data?.accessToken || null;
    if (newToken) setAccessToken(newToken);
    return newToken;
  },
};

export default authService;
