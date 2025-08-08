// File: client/src/services/authService.js

// --- REPLACE START: import unified axios instance ---
import api, { setAccessToken } from "../utils/axiosInstance";
// --- REPLACE END ---

const authService = {
  login: async function (credentials) {
    // --- REPLACE START: login endpoint must use our `api` instance ---
    const response = await api.post("/auth/login", credentials);
    // --- REPLACE END ---
    const { accessToken, user } = response.data;
    setAccessToken(accessToken);
    return { user, accessToken };
  },

  logout: async function () {
    try {
      // --- REPLACE START: logout endpoint must use our `api` instance ---
      await api.post("/auth/logout");
      // --- REPLACE END ---
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      setAccessToken(null);
    }
  },

  revokeToken: async function () {
    try {
      // --- REPLACE START: revoke endpoint is same as logout ---
      await api.post("/auth/logout");
      // --- REPLACE END ---
    } catch (err) {
      console.error("Error revoking token:", err);
    }
  },

  refresh: async function () {
    // --- REPLACE START: refresh endpoint must use our `api` instance ---
    const res = await api.post("/auth/refresh");
    // --- REPLACE END ---
    const newToken = res.data.accessToken;
    setAccessToken(newToken);
    return newToken;
  },
};

export default authService;
