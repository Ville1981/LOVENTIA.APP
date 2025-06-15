import React, { createContext, useContext, useEffect, useState } from "react";
import { setAccessToken } from "../utils/axiosInstance"; // ✅ Päivittää tokenin käyttöön api.pyynnöille

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);

  const login = (newToken) => {
    // ✅ Päivitetään axiosInstancein token
    setAccessToken(newToken);
    setToken(newToken);

    // ✅ LocalStorage fallback
    localStorage.setItem("token", newToken);
  };

  const logout = () => {
    setAccessToken(null);
    setToken(null);
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  // Huolehditaan, että mountatessa paikallinen token otetaan käyttöön
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      setAccessToken(storedToken); // ✅ Varmistetaan että axios käyttää sitä
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
