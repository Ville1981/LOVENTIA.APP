// client/src/contexts/AuthContext.jsx

// --- REPLACE START: robust AuthContext with setAuthUser function ---
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import api, {
  // Backward-compatible names from axiosInstance:
  setAccessToken as attachAccessToken, // keep old call sites working
  getAccessToken,
} from "../services/api/axiosInstance";

/**
 * AuthContext value shape
 * - user: current user object (or null)
 * - setUser / setAuthUser: updater to avoid TypeError in existing pages
 * - accessToken: current access token (or null)
 * - login, register, logout, refreshMe: helpers
 * - bootstrapped: indicates initial auth check completed
 */
const AuthContext = createContext({
  user: null,
  setUser: () => {},
  setAuthUser: () => {},
  accessToken: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshMe: async () => {},
  bootstrapped: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [accessToken, setAccessTokenState] = useState(getAccessToken() || null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Keep axios header in sync when token changes
  useEffect(() => {
    attachAccessToken(accessToken);
  }, [accessToken]);

  // Single setter exposed under two names for backward compat
  const setAuthUser = useCallback((u) => setUserState(u), []);

  const refreshMe = useCallback(async () => {
    try {
      // IMPORTANT: send {} (not null) so body-parser doesn't choke in strict mode
      const r = await api.post("/api/auth/refresh", {}, { withCredentials: true });
      const next = r?.data?.accessToken;

      // --- IMPORTANT FIX: attach the token immediately before calling /me ---
      if (next) {
        attachAccessToken(next);      // ensure subsequent calls include Bearer
        setAccessTokenState(next);    // keep React state in sync
      }
      // --- END FIX ---

      // then fetch /me (now goes out with Authorization: Bearer <token>)
      const me = await api.get("/api/auth/me");
      const current = me?.data?.user || null;
      setUserState(current);
      return current;
    } catch {
      // If refresh/me fails, clear local state but do not hard-crash UI
      setUserState(null);
      setAccessTokenState(null);
      attachAccessToken(null);
      return null;
    }
  }, []);

  // Bootstrap on mount
  useEffect(() => {
    (async () => {
      await refreshMe();
      setBootstrapped(true);
    })();
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    // After a successful login, server returns accessToken and sets refresh cookie
    const res = await api.post(
      "/api/auth/login",
      { email, password },
      { withCredentials: true }
    );
    const token = res?.data?.accessToken;
    if (token) {
      setAccessTokenState(token);
      attachAccessToken(token); // attach immediately so subsequent /me has Bearer
    }
    const me = await api.get("/api/auth/me");
    const current = me?.data?.user || null;
    setUserState(current);
    return current;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post("/api/auth/register", payload, {
      withCredentials: true,
    });
    const token = res?.data?.accessToken;
    if (token) {
      setAccessTokenState(token);
      attachAccessToken(token);
    }
    const me = await api.get("/api/auth/me");
    const current = me?.data?.user || null;
    setUserState(current);
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      // Use {} instead of null to avoid strict JSON parser throwing
      await api.post("/api/auth/logout", {}, { withCredentials: true });
    } finally {
      setUserState(null);
      setAccessTokenState(null);
      attachAccessToken(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser: setUserState,
      setAuthUser, // keep this exact name for existing components
      accessToken,
      login,
      register,
      logout,
      refreshMe,
      bootstrapped,
    }),
    [
      user,
      setUserState,
      setAuthUser,
      accessToken,
      login,
      register,
      logout,
      refreshMe,
      bootstrapped,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
// --- REPLACE END ---
