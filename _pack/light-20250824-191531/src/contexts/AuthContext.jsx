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
import api from "../utils/axiosInstance";

/**
 * Minimal helpers to attach/read the access token.
 * We do not assume named exports exist in axiosInstance,
 * so we set the Authorization header directly on the axios instance.
 */
function attachAccessToken(token) {
  try {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      try {
        localStorage.setItem("accessToken", token);
      } catch {
        /* ignore storage errors */
      }
    } else {
      delete api.defaults.headers.common["Authorization"];
      try {
        localStorage.removeItem("accessToken");
      } catch {
        /* ignore storage errors */
      }
    }
  } catch {
    /* noop */
  }
}
function getAccessToken() {
  try {
    return localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

/**
 * AuthContext value shape
 * - user: current user object (or null)
 * - setUser / setAuthUser: updater to avoid TypeError in existing pages
 * - accessToken: current access token (or null)
 * - login, register, logout, refreshMe/refreshUser: helpers
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
  refreshUser: async () => {},
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

  // Small helper: GET me from either /auth/me or /users/me (fallback)
  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get("/api/auth/me");
      return me?.data?.user ?? me?.data ?? null;
    } catch {
      try {
        const me2 = await api.get("/api/users/me");
        return me2?.data?.user ?? me2?.data ?? null;
      } catch {
        return null;
      }
    }
  }, []);

  // Try to refresh token (cookie-based) then fetch /me
  const refreshMe = useCallback(async () => {
    try {
      // Always attempt cookie-based refresh
      try {
        const r = await api.post("/api/auth/refresh", {}, { withCredentials: true });
        const next = r?.data?.accessToken;
        if (next) {
          attachAccessToken(next);   // attach immediately
          setAccessTokenState(next); // keep React state in sync
        }
      } catch {
        // If refresh endpoint doesn't exist, continue and just call /me
      }

      const current = await fetchMe();
      setUserState(current);
      return current;
    } catch {
      setUserState(null);
      setAccessTokenState(null);
      attachAccessToken(null);
      return null;
    }
  }, [fetchMe]);

  // Backward-compatible alias
  const refreshUser = refreshMe;

  // Bootstrap on mount
  useEffect(() => {
    (async () => {
      await refreshMe();
      setBootstrapped(true);
    })();
  }, [refreshMe]);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post(
        "/api/auth/login",
        { email, password },
        { withCredentials: true }
      );
      const token = res?.data?.accessToken;
      if (token) {
        setAccessTokenState(token);
        attachAccessToken(token);
      }
      const current = await fetchMe();
      setUserState(current);
      return current;
    },
    [fetchMe]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post("/api/auth/register", payload, { withCredentials: true });
      const token = res?.data?.accessToken;
      if (token) {
        setAccessTokenState(token);
        attachAccessToken(token);
      }
      const current = await fetchMe();
      setUserState(current);
      return current;
    },
    [fetchMe]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", {}, { withCredentials: true });
    } catch {
      // ignore network/logout endpoint errors
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
      refreshUser, // alias for older call sites
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
      refreshUser,
      bootstrapped,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
// --- REPLACE END ---
