// File: client/src/context/AuthContext.jsx

import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { setAccessToken } from '../utils/axiosInstance';

// Default context values
const AuthContext = createContext({
  user: null,
  loading: true,
  // --- REPLACE START: add isLoggedIn default value ---
  isLoggedIn: false,
  // --- REPLACE END ---
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        // --- REPLACE START: call refresh endpoint without extra '/api' and load profile correctly ---
        const refreshRes = await api.post('/auth/refresh');
        const { accessToken } = refreshRes.data || {};
        if (accessToken) {
          setAccessToken(accessToken);
          const profileRes = await api.get('/auth/me');
          // server returns { user: {...} }, use the nested object
          setUser(profileRes.data?.user || null);
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

  const login = async (email, password) => {
    // --- REPLACE START: call login endpoint without extra '/api' and set user from /auth/me ---
    const res = await api.post('/auth/login', { email, password });
    const { accessToken: newToken } = res.data || {};
    if (newToken) setAccessToken(newToken);
    const profileRes = await api.get('/auth/me');
    setUser(profileRes.data?.user || null);
    return profileRes.data?.user || null;
    // --- REPLACE END ---
  };

  const logout = async () => {
    try {
      // --- REPLACE START: call logout endpoint without extra '/api' ---
      await api.post('/auth/logout');
      // --- REPLACE END ---
    } catch (err) {
      console.warn('Logout request failed:', err);
    }
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        // --- REPLACE START: derive isLoggedIn from user state ---
        isLoggedIn: !!user,
        // --- REPLACE END ---
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook for consuming AuthContext
export function useAuth() {
  return useContext(AuthContext);
}
