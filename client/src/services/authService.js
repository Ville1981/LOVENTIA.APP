// File: src/services/authService.js

// Service for authentication actions: login, logout, revoke tokens

import api, { setAccessToken } from "../utils/axiosInstance";

const authService = {
  /**
   * Perform user login by sending credentials to backend.
   * On success, persists the returned accessToken.
   * @param {{ username: string, password: string }} credentials
   * @returns {Promise<object>} user data and tokens
   */
  login: async function (credentials) {
    // The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed
    // --- REPLACE START: login endpoint must use our `api` instance with credentials included ---
    const response = await api.post("/auth/login", credentials);
    // --- REPLACE END ---
    
    const { accessToken, user } = response.data;
    setAccessToken(accessToken);
    return { user, accessToken };
  },

  /**
   * Logout the current user by revoking refresh token and clearing credentials.
   * Clears the in-memory access token as well.
   */
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

  /**
   * Explicitly rotate or revoke the current refresh token on the server.
   * Alias for logout in this implementation.
   */
  revokeToken: async function () {
    try {
      // --- REPLACE START: revoke endpoint is same as logout ---
      await api.post("/auth/logout");
      // --- REPLACE END ---
    } catch (err) {
      console.error("Error revoking token:", err);
    }
  },

  /**
   * Manually trigger a refresh of the access token.
   * Uses our `api` instance so credentials (cookies) are sent.
   * @returns {Promise<string>} the new access token
   */
  refresh: async function () {
    // This method may not be needed if your interceptor auto-refreshes,
    // but is provided here for explicit calls.
    // --- REPLACE START: refresh endpoint must use our `api` instance ---
    const res = await api.post("/auth/refresh");
    // --- REPLACE END ---
    
    const newToken = res.data.accessToken;
    setAccessToken(newToken);
    return newToken;
  },
};

export default authService;
