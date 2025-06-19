// client/src/context/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken } from "../utils/axiosInstance";

// Alustetaan konteksti oletusarvoilla, jotta useAuth-kutsu ei tuota undefined-virhettä
const AuthContext = createContext({
  token: null,
  login: () => {},
  logout: () => {},
  isLoggedIn: false,
});

export const AuthProvider = ({ children }) => {
  // token kertoo, onko käyttäjä kirjautuneena
  const [token, setToken]     = useState(null);
  // loading estää lapset-renderöinnin ennen kuin initAuth on suoritettu
  const [loading, setLoading] = useState(true);

  const login = (newToken) => {
    // Päivitä axios-instanssin token, React state ja localStorage
    setAccessToken(newToken);
    setToken(newToken);
    localStorage.setItem("token", newToken);
  };

  const logout = () => {
    // Tyhjennä token sekä instanssista että localStoragesta
    setAccessToken(null);
    setToken(null);
    localStorage.removeItem("token");
    // Ohjaa login-sivulle
    window.location.href = "/login";
  };

  useEffect(() => {
    const initAuth = async () => {
      // 1) Haetaan mahdollinen aiemmin tallennettu token
      const stored = localStorage.getItem("token");
      if (stored) {
        setAccessToken(stored);
        setToken(stored);
      }

      // 2) Yritetään “silent refresh” (ei pakota /login here)
      try {
        const { data } = await api.post("/auth/refresh");
        // Jos saadaan uusi token, kirjaudutaan sisään sen avulla
        login(data.accessToken);
      } catch (err) {
        console.warn("Silent refresh epäonnistui, selvitellään julkisia reittejä.", err);
        // Poistetaan vanhentunut token, mutta EI OHJATA LOGIN:iin
        setAccessToken(null);
        setToken(null);
        localStorage.removeItem("token");
      } finally {
        // Annetaan lapset-renderöityä (login/register jne. latautuvat nyt)
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Katsotaan, että sivuston julkiset reitit (esim. /login) saavat näkyä ilman jäätynyttä loading-tilaa
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
        login,
        logout,
        isLoggedIn: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
