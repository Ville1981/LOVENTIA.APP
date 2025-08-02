// src/services/authService.js
// Service for authentication actions: login, logout, revoke tokens

import api, { setAccessToken } from '../utils/axiosInstance';

const authService = {
  /**
   * Perform user login by sending credentials to backend.
   * On success, persists the returned accessToken.
   * @param {{ username: string, password: string }} credentials
   * @returns {Promise<object>} user data and tokens
   */
  login: async function (credentials) {
    // --- REPLACE START: login endpoint ---
    const response = await api.post('/auth/login', credentials);
    // --- REPLACE END ---
    const { accessToken, user } = response.data;
    setAccessToken(accessToken);
    return { user, accessToken };
  },

  /**
   * Logout the current user by revoking refresh token and clearing credentials.
   */
  logout: async function () {
    try {
      // --- REPLACE START: logout endpoint ---
      await api.post('/auth/logout');
      // --- REPLACE END ---
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      setAccessToken(null);
    }
  },

  /**
   * Explicitly revoke the current refresh token on the server.
   */
  revokeToken: async function () {
    try {
      // --- REPLACE START: revoke endpoint (alias for logout) ---
      await api.post('/auth/logout');
      // --- REPLACE END ---
    } catch (err) {
      console.error('Error revoking token:', err);
    }
  },
};

export default authService;
