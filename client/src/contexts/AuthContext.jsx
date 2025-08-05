import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { setAccessToken } from '../services/api/axiosInstance';

/**
 * AuthContext handles user authentication state, login, logout, and token persistence.
 */
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
        // --- REPLACE START: call refresh endpoint and set token ---
        const refreshRes = await api.post('/auth/refresh');
        const { accessToken } = refreshRes.data;
        if (accessToken) {
          setAccessToken(accessToken);
          const profileRes = await api.get('/auth/me');
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

  const login = async (email, password) => {
    // --- REPLACE START: call login endpoint and set token ---
    const res = await api.post('/auth/login', { email, password });
    const { accessToken: newToken } = res.data;
    setAccessToken(newToken);
    // --- REPLACE END ---

    const profileRes = await api.get('/auth/me');
    setUser(profileRes.data);
    return profileRes.data;
  };

  const logout = async () => {
    try {
      // --- REPLACE START: call logout endpoint ---
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

export function useAuth() {
  return useContext(AuthContext);
}
