// client/src/contexts/AuthContext.jsx

import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { setAccessToken } from '../services/api/axiosInstance';

/**
 * AuthContext handles user authentication state, login, logout, and token persistence.
 */
const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  // user can be null or an object with user info
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, attempt silent refresh and fetch user
  useEffect(() => {
    async function initAuth() {
      try {
        // --- REPLACE START: call refresh endpoint and set token ---
        const refreshRes = await api.post(
          '/auth/refresh',
          {},
          { withCredentials: true }
        );
        const { accessToken } = refreshRes.data;
        if (accessToken) {
          setAccessToken(accessToken);
          // Fetch current user profile
          const profileRes = await api.get(
            '/auth/me',
            { withCredentials: true }
          );
          setUser(profileRes.data);
        }
        // --- REPLACE END ---
      } catch (err) {
        console.warn('Auth silent refresh failed:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  /**
   * Logs in with email & password, stores token, fetches profile
   */
  const login = async (email, password) => {
    // --- REPLACE START: call login endpoint and set token ---
    const res = await api.post(
      '/auth/login',
      { email, password },
      { withCredentials: true }
    );
    const { accessToken: newToken } = res.data;
    setAccessToken(newToken);
    // --- REPLACE END ---

    // Fetch profile
    const profileRes = await api.get(
      '/auth/me',
      { withCredentials: true }
    );
    setUser(profileRes.data);
    return profileRes.data;
  };

  /**
   * Logs out by clearing token and user state, and calling backend logout
   */
  const logout = async () => {
    try {
      // --- REPLACE START: call logout endpoint ---
      await api.post(
        '/auth/logout',
        {},
        { withCredentials: true }
      );
      // --- REPLACE END ---
    } catch (err) {
      console.warn('Logout request failed:', err);
    }

    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use auth
 */
export function useAuth() {
  return useContext(AuthContext);
}

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed