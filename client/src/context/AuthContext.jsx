import React, { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken } from "../utils/axiosInstance";

// Alustetaan konteksti oletusarvoilla, jotta useAuth-kutsu ei tuota undefined-virhettä
const AuthContext = createContext({
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
  isLoggedIn: false,
  isAdmin: false,
});

export const AuthProvider = ({ children }) => {
  // token kertoo, onko käyttäjä kirjautuneena
  const [token, setToken]     = useState(null);
  // user sisältää id, email ja role
  const [user, setUser]       = useState(null);
  // loading estää lapset-renderöinnin ennen kuin initAuth on suoritettu
  const [loading, setLoading] = useState(true);

  // Sisäinen funktio hakemaan user-data /auth/me -endpointista
  const fetchUser = async () => {
    try {
      const { data } = await api.get("/auth/me");
      // data: { id, email, role }
      setUser(data);
    } catch (err) {
      console.warn("fetchUser epäonnistui:", err);
      setUser(null);
    }
  };

  const login = async (newToken) => {
    // Päivitä axios-instanssin token, React state ja localStorage
    setAccessToken(newToken);
    setToken(newToken);
    localStorage.setItem("token", newToken);

    // Hae heti käyttäjätiedot
    await fetchUser();
  };

  const logout = async () => {
    // Kutsutaan backend logout, jotta HttpOnly-cookie poistuu
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout-backend epäonnistui", err);
    }
    // Tyhjennä token instanssista, statesta ja localStoragesta
    setAccessToken(null);
    setToken(null);
    setUser(null);
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
        await login(data.accessToken);
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

  // Varmistetaan, että julkiset reitit saavat näkyä ilman jäätynyttä loading-tilaa
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

export const useAuth = () => useContext(AuthContext);
