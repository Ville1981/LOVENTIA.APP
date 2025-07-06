// src/context/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken } from "../utils/axiosInstance";

// Alustetaan konteksti oletusarvoilla, jotta useAuth-kutsu ei tuota undefined-virhettä
const AuthContext = createContext({
  token: null,
  user: null,
  setUser: () => {},          // lisätty stub
  login: async () => {},
  logout: async () => {},
  isLoggedIn: false,
  isAdmin: false,
});

export const AuthProvider = ({ children }) => {
  const [token, setToken]     = useState(null); // JWT-token
  const [user, setUser]       = useState(null); // { id, email, role }
  const [loading, setLoading] = useState(true); // estää lapset-renderöinnin initAuthin aikana

  // Hakee käyttäjätiedot backendistä /auth/me
  const fetchUser = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (err) {
      console.warn("fetchUser epäonnistui:", err);
      setUser(null);
    }
  };

  // Kirjautuminen: talletetaan token, päivitämme axios-instanssin ja noudetaan käyttäjä
  const login = async (newToken) => {
    setAccessToken(newToken);
    setToken(newToken);
    localStorage.setItem("token", newToken);
    await fetchUser();
  };

  // Uloskirjautuminen: tyhjennetään token ja ohjataan login-sivulle
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout-backend epäonnistui", err);
    }
    setAccessToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  // InitAuth: haetaan localStoragesta token, yritetään refresh ja lopulta annetaan lapset-renderöityä
  useEffect(() => {
    const initAuth = async () => {
      const stored = localStorage.getItem("token");
      if (stored) {
        setAccessToken(stored);
        setToken(stored);
      }

      try {
        const { data } = await api.post("/auth/refresh");
        // refresh-palauttaa uuden accessTokenin
        await login(data.accessToken);
      } catch (err) {
        console.warn("Silent refresh epäonnistui:", err);
        setAccessToken(null);
        setToken(null);
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Jos backendia ja localStoragea käydään läpi, näytetään latausteksti siihen asti
  if (loading) {
    return (
      <div className="text-center py-8">
        Kirjautumistilaa tarkistetaan…
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        setUser,               // lisätty setter kontekstiin
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

// Helppo hook kuluttajille
export const useAuth = () => {
  return useContext(AuthContext);
};
