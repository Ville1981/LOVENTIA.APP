// --- REPLACE START: robust AuthContext with guarded refreshMe + merge-updates from API ---
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import api, {
  attachAccessToken as _attachAccessToken,
  getAccessToken as _getAccessToken,
} from "../services/api/axiosInstance";

/**
 * Token helpers
 * - Prefer named helpers from axiosInstance (exported there),
 *   but keep safe fallbacks to avoid crashing if imports change.
 */
function attachAccessToken(token) {
  try {
    if (typeof _attachAccessToken === "function") {
      _attachAccessToken(token);
      return;
    }
  } catch {
    /* ignore */
  }
  // Fallback (defensive): mirror minimal behavior
  try {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage?.setItem?.("accessToken", token);
    } else {
      delete api.defaults.headers.common["Authorization"];
      localStorage?.removeItem?.("accessToken");
    }
  } catch {
    /* ignore */
  }
}

function getAccessToken() {
  try {
    if (typeof _getAccessToken === "function") return _getAccessToken();
  } catch {
    /* ignore */
  }
  try {
    return localStorage?.getItem?.("accessToken") || null;
  } catch {
    return null;
  }
}

/**
 * Lightweight user equality to avoid unnecessary state changes/re-renders.
 * We compare stable identifiers and the most UI-relevant flags.
 */
function areUsersEffectivelyEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;

  const ida = a.id || a._id || null;
  const idb = b.id || b._id || null;
  if (ida !== idb) return false;

  const emailA = a.email || a.username || null;
  const emailB = b.email || b.username || null;
  if (emailA !== emailB) return false;

  // Normalize premium flags
  const premA = Boolean(a.isPremium ?? a.premium);
  const premB = Boolean(b.isPremium ?? b.premium);
  if (premA !== premB) return false;

  const picA = a.profilePicture || a.profilePhoto || null;
  const picB = b.profilePicture || b.profilePhoto || null;
  if (picA !== picB) return false;

  return true;
}

/**
 * Merge only defined values from src into dst (shallow).
 * Avoids clobbering existing fields with undefined/null from partial responses.
 */
function mergeDefined(dst, src) {
  if (!src) return { ...dst };
  const out = { ...(dst || {}) };
  Object.keys(src).forEach((k) => {
    const v = src[k];
    if (v !== undefined) out[k] = v;
  });
  return out;
}

/**
 * Normalize server user payload shape
 * - Extracts user from {user} if present
 * - Mirrors profilePhoto → profilePicture when only one exists
 * - Ensures photos/extraImages arrays exist & are mirrored
 * - Keeps visibility defaults present
 */
function normalizeUserPayload(raw) {
  const u = raw?.user ?? raw ?? null;
  if (!u || typeof u !== "object") return null;
  const copy = { ...u };

  // Mirror single image
  if (copy.profilePhoto && !copy.profilePicture) copy.profilePicture = copy.profilePhoto;
  if (copy.profilePicture && !copy.profilePhoto) copy.profilePhoto = copy.profilePicture;

  // Ensure arrays
  if (!Array.isArray(copy.photos)) copy.photos = copy.photos ? [copy.photos].filter(Boolean) : [];
  if (!Array.isArray(copy.extraImages)) {
    copy.extraImages = copy.extraImages ? [copy.extraImages].filter(Boolean) : copy.photos;
  }
  // Keep both arrays mirrored to avoid FE surprises
  if (copy.photos.length && !copy.extraImages.length) copy.extraImages = [...copy.photos];
  if (copy.extraImages.length && !copy.photos.length) copy.photos = [...copy.extraImages];

  // Visibility defaults
  copy.visibility = copy.visibility || { isHidden: false, hiddenUntil: null, resumeOnLogin: true };

  return copy;
}

/**
 * AuthContext shape
 */
const AuthContext = createContext({
  user: null,
  setUser: () => {},
  setAuthUser: () => {},
  mergeUser: () => {},
  accessToken: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshMe: async () => {},
  refreshUser: async () => {},
  applyUserFromApi: () => {},
  bootstrapped: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [accessToken, setAccessTokenState] = useState(getAccessToken() || null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Prevent overlapping refresh calls
  const refreshInFlightRef = useRef(null);

  // Keep axios header in sync when token changes
  useEffect(() => {
    attachAccessToken(accessToken);
  }, [accessToken]);

  // Replace user only if it meaningfully changes
  const setAuthUser = useCallback((incomingRaw) => {
    const incoming = normalizeUserPayload(incomingRaw);
    setUserState((prev) => {
      if (!incoming) return prev ?? null;
      return areUsersEffectivelyEqual(prev, incoming) ? prev : incoming;
    });
  }, []);

  // Merge defined fields (shallow) – used after partial profile updates
  const mergeUser = useCallback((partialRaw) => {
    const partial = normalizeUserPayload(partialRaw) || partialRaw;
    setUserState((prev) => mergeDefined(prev, partial || {}));
  }, []);

  /**
   * Fetch current user from preferred endpoints.
   * Returns a user object or null (never throws).
   */
  const fetchMe = useCallback(async () => {
    // 1) New unified endpoint
    try {
      const r0 = await api.get("/api/me");
      return normalizeUserPayload(r0?.data ?? null);
    } catch {
      // 2) Legacy (users/profile)
      try {
        const r1 = await api.get("/api/users/profile");
        return normalizeUserPayload(r1?.data ?? null);
      } catch {
        // 3) Legacy alt
        try {
          const r2 = await api.get("/api/auth/me");
          return normalizeUserPayload(r2?.data ?? null);
        } catch {
          return null;
        }
      }
    }
  }, []);

  /**
   * Refresh access token (cookie-based) and then load /me.
   * Guards against concurrent calls: if one is in-flight, re-use it.
   */
  const refreshMe = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const task = (async () => {
      try {
        // Try refresh; ignore if endpoint missing (axiosInstance also handles refresh on 401)
        try {
          const r = await api.post("/api/auth/refresh", {}, { withCredentials: true });
          const next = r?.data?.accessToken || r?.data?.token || null;
          if (next && next !== getAccessToken()) {
            attachAccessToken(next);
            setAccessTokenState(next);
          }
        } catch {
          /* absence of refresh is OK */
        }

        const current = await fetchMe();
        setAuthUser(current); // guarded replace (not forced)
        return current;
      } catch {
        // On hard failure, clear auth state
        setAuthUser(null);
        setAccessTokenState(null);
        attachAccessToken(null);
        return null;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = task;
    return task;
  }, [fetchMe, setAuthUser]);

  // Backward-compatible alias
  const refreshUser = refreshMe;

  // Helper to apply user payloads coming from various API responses
  const applyUserFromApi = useCallback(
    (respData, { merge = false } = {}) => {
      const normalized = normalizeUserPayload(respData);
      if (!normalized) return;
      if (merge) mergeUser(normalized);
      else setAuthUser(normalized);
    },
    [mergeUser, setAuthUser]
  );

  // Bootstrap on mount (single run)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshMe();
      } finally {
        if (alive) setBootstrapped(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshMe]);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post(
        "/api/auth/login",
        { email, password },
        { withCredentials: true }
      );
      const token = res?.data?.accessToken || res?.data?.token || null;
      if (token && token !== getAccessToken()) {
        setAccessTokenState(token);
        attachAccessToken(token);
      }
      const current = await fetchMe();
      setAuthUser(current);
      return current;
    },
    [fetchMe, setAuthUser]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post("/api/auth/register", payload, { withCredentials: true });
      const token = res?.data?.accessToken || res?.data?.token || null;
      if (token && token !== getAccessToken()) {
        setAccessTokenState(token);
        attachAccessToken(token);
      }
      const current = await fetchMe();
      setAuthUser(current);
      return current;
    },
    [fetchMe, setAuthUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", {}, { withCredentials: true });
    } catch {
      // ignore endpoint/network errors
    } finally {
      setAuthUser(null);
      setAccessTokenState(null);
      attachAccessToken(null);
    }
  }, [setAuthUser]);

  const value = useMemo(
    () => ({
      user,
      setUser: setAuthUser, // legacy alias (replace-when-meaningful)
      setAuthUser,          // preferred name (replace-when-meaningful)
      mergeUser,            // shallow merge of defined keys
      applyUserFromApi,     // helper to ingest /api/users/profile etc. responses
      accessToken,
      login,
      register,
      logout,
      refreshMe,
      refreshUser,
      bootstrapped,
    }),
    [
      user,
      setAuthUser,
      mergeUser,
      applyUserFromApi,
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
