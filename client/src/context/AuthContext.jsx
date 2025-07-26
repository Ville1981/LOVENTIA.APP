// src/context/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken } from "../utils/axiosInstance";

// Initialize context with defaults to avoid undefined errors
const AuthContext = createContext({
  token: null,
  user: null,
  setUser: () => {},
  login: async () => {},
  logout: async () => {},
  isLoggedIn: false,
  isAdmin: false,
});

export const AuthProvider = ({ children }) => {
  const [token, setToken]     = useState(null); // JWT token
  const [user, setUser]       = useState(null); // { id, email, role }
  const [loading, setLoading] = useState(true); // block children until init complete

  // Fetch current user from backend
  const fetchUser = async () => {
    try {
      // --- REPLACE START: use '/api/auth/me' endpoint ---
      const { data } = await api.get("/api/auth/me");
      // --- REPLACE END ---
      setUser(data);
    } catch (err) {
      console.warn("fetchUser failed:", err);
      setUser(null);
    }
  };

  // Log in: store token, update axios, then fetch user
  const login = async (newToken) => {
    setAccessToken(newToken);
    setToken(newToken);
    localStorage.setItem("token", newToken);
    await fetchUser();
  };

  // Log out: call backend then clear token and redirect
  const logout = async () => {
    try {
      // --- REPLACE START: call '/api/auth/logout' ---
      await api.post("/api/auth/logout");
      // --- REPLACE END ---
    } catch (err) {
      console.warn("Logout request failed:", err);
    }
    setAccessToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  // Initialize authentication: load token, refresh it, then finish loading
  useEffect(() => {
    const initAuth = async () => {
      const stored = localStorage.getItem("token");
      if (stored) {
        setAccessToken(stored);
        setToken(stored);
      }

      try {
        // --- REPLACE START: call '/api/auth/refresh' ---
        const { data } = await api.post("/api/auth/refresh");
        // --- REPLACE END ---
        await login(data.accessToken);
      } catch (err) {
        console.warn("Silent refresh failed:", err);
        setAccessToken(null);
        setToken(null);
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // While loading, show a placeholder message
  if (loading) {
    return (
      <div className="text-center py-8">
        Checking authentication…
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        setUser,
        login,
        logout,
        isLoggedIn: !!token,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook for easy consumption
export const useAuth = () => useContext(AuthContext);
