// --- REPLACE START: robust AuthContext with setAuthUser function ---
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api, {
  // Backward-compatible names from axiosInstance:
  setAccessToken as attachAccessToken, // keep old call sites working
  getAccessToken,
} from '../utils/axiosInstance'; // ← fixed path

/**
 * AuthContext value shape
 * - authUser: current user object (or null)
 * - setAuthUser: updater to avoid TypeError in existing pages
 * - accessToken: current access token (or null)
 * - login, register, logout, refreshMe: helpers
 * - bootstrapped: indicates initial auth check completed
 */
const AuthContext = createContext({
  authUser: null,
  setAuthUser: () => {},
  accessToken: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshMe: async () => {},
  bootstrapped: false, // ← added for completeness
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(getAccessToken() || null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Keep axios header in sync when token changes
  useEffect(() => {
    attachAccessToken(accessToken);
  }, [accessToken]);

  const refreshMe = useCallback(async () => {
    try {
      // IMPORTANT: send {} (not null) so body-parser doesn't choke in strict mode
      const r = await api.post('/auth/refresh', {}, { withCredentials: true });
      const next = r?.data?.accessToken;
      if (next) setAccessTokenState(next);

      // then fetch /me
      const me = await api.get('/auth/me');
      setAuthUser(me?.data?.user || null);
      return me?.data?.user || null;
    } catch (err) {
      // If refresh/me fails, clear local state but do not hard-crash UI
      setAuthUser(null);
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
    const res = await api.post('/auth/login', { email, password }, { withCredentials: true });
    const token = res?.data?.accessToken;
    if (token) {
      setAccessTokenState(token);
      attachAccessToken(token); // attach immediately so subsequent /me has Bearer
    }
    const me = await api.get('/auth/me');
    setAuthUser(me?.data?.user || null);
    return me?.data?.user || null;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload, { withCredentials: true });
    const token = res?.data?.accessToken;
    if (token) {
      setAccessTokenState(token);
      attachAccessToken(token);
    }
    const me = await api.get('/auth/me');
    setAuthUser(me?.data?.user || null);
    return me?.data?.user || null;
  }, []);

  const logout = useCallback(async () => {
    try {
      // Use {} instead of null to avoid strict JSON parser throwing
      await api.post('/auth/logout', {}, { withCredentials: true });
    } finally {
      setAuthUser(null);
      setAccessTokenState(null);
      attachAccessToken(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      authUser,
      setAuthUser, // keep this exact name for existing components
      accessToken,
      login,
      register,
      logout,
      refreshMe,
      bootstrapped,
    }),
    [authUser, accessToken, login, register, logout, refreshMe, bootstrapped]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
// --- REPLACE END ---
