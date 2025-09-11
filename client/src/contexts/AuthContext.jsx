// File: client/src/contexts/AuthContext.jsx

// --- REPLACE START: robust AuthContext with guarded refreshMe + billing reconcile + premium exposure ---
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
import { syncBilling } from "../api/billing";

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
  // Fallback (defensive)
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
 * Lightweight equality to avoid unnecessary state updates.
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

  const premA = Boolean(a.isPremium ?? a.premium);
  const premB = Boolean(b.isPremium ?? b.premium);
  if (premA !== premB) return false;

  const picA = a.profilePicture || a.profilePhoto || null;
  const picB = b.profilePicture || b.profilePhoto || null;
  if (picA !== picB) return false;

  return true;
}

/**
 * Shallow merge where only defined values from src are applied.
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
 * Normalize server user payload to a consistent shape for the app.
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
  if (copy.photos.length && !copy.extraImages.length) copy.extraImages = [...copy.photos];
  if (copy.extraImages.length && !copy.photos.length) copy.photos = [...copy.extraImages];

  // Visibility defaults
  copy.visibility = copy.visibility || { isHidden: false, hiddenUntil: null, resumeOnLogin: true };

  // Normalize premium flag
  copy.isPremium = Boolean(copy.isPremium ?? copy.premium);

  return copy;
}

/**
 * Context shape
 */
const AuthContext = createContext({
  user: null,
  isPremium: false,
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
  reconcileBillingNow: async () => {},
  bootstrapped: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [accessToken, setAccessTokenState] = useState(getAccessToken() || null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const refreshInFlightRef = useRef(null);
  const billingSyncInFlightRef = useRef(null);

  // Keep axios header in sync when token changes
  useEffect(() => {
    attachAccessToken(accessToken);
  }, [accessToken]);

  // Replace user only when it meaningfully changes
  const setAuthUser = useCallback((incomingRaw) => {
    const incoming = normalizeUserPayload(incomingRaw);
    setUserState((prev) => {
      if (!incoming) return prev ?? null;
      return areUsersEffectivelyEqual(prev, incoming) ? prev : incoming;
    });
  }, []);

  // Shallow merge partial updates
  const mergeUser = useCallback((partialRaw) => {
    const partial = normalizeUserPayload(partialRaw) || partialRaw;
    setUserState((prev) => mergeDefined(prev, partial || {}));
  }, []);

  /**
   * Load current user from preferred endpoints.
   */
  const fetchMe = useCallback(async () => {
    try {
      const r0 = await api.get("/api/me");
      return normalizeUserPayload(r0?.data ?? null);
    } catch {
      try {
        const r1 = await api.get("/api/users/profile");
        return normalizeUserPayload(r1?.data ?? null);
      } catch {
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
   * Reconcile billing with the server (Stripe as source of truth),
   * then update user premium flag locally without clobbering other fields.
   */
  const reconcileBillingNow = useCallback(async () => {
    if (billingSyncInFlightRef.current) return billingSyncInFlightRef.current;
    const task = (async () => {
      try {
        const payload = await syncBilling();
        if (payload && typeof payload.isPremium === "boolean") {
          setUserState((prev) => mergeDefined(prev, { isPremium: payload.isPremium }));
        }
        return payload;
      } catch (e) {
        console.warn("[AuthContext] Billing sync failed:", e?.message || e);
        return null;
      } finally {
        billingSyncInFlightRef.current = null;
      }
    })();
    billingSyncInFlightRef.current = task;
    return task;
  }, []);

  /**
   * Refresh access token (cookie-based) and then load /me.
   * Also runs a billing reconcile to capture subscription changes.
   */
  const refreshMe = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    const task = (async () => {
      try {
        // Try refresh; tolerate absence
        try {
          const r = await api.post("/api/auth/refresh", {}, { withCredentials: true });
          const next = r?.data?.accessToken || r?.data?.token || null;
          if (next && next !== getAccessToken()) {
            attachAccessToken(next);
            setAccessTokenState(next);
          }
        } catch {
          /* ignore */
        }

        // Reconcile billing (ensures isPremium stays accurate)
        await reconcileBillingNow();

        // Fetch user
        const current = await fetchMe();
        setAuthUser(current);
        return current;
      } catch {
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
  }, [fetchMe, setAuthUser, reconcileBillingNow]);

  // Backward-compatible alias
  const refreshUser = refreshMe;

  // Helper to ingest user-bearing responses
  const applyUserFromApi = useCallback(
    (respData, { merge = false } = {}) => {
      const normalized = normalizeUserPayload(respData);
      if (!normalized) return;
      if (merge) mergeUser(normalized);
      else setAuthUser(normalized);
    },
    [mergeUser, setAuthUser]
  );

  /**
   * Detect if we returned from a Stripe Checkout or Billing Portal
   * and trigger an immediate reconcile.
   * Common return indicators:
   *  - success, canceled, session_id (Checkout)
   *  - portal_session_id, return_from=portal (Portal)
   */
  const detectBillingReturnAndReconcile = useCallback(async () => {
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const hasCheckoutFlag =
        qs.has("success") || qs.has("canceled") || qs.has("session_id");
      const hasPortalFlag =
        qs.has("return_from") || qs.has("portal_session_id");

      if (hasCheckoutFlag || hasPortalFlag) {
        // Reconcile with backend
        const payload = await reconcileBillingNow();

        // Optionally tidy query string to avoid repeated syncs on soft nav
        try {
          const url = new URL(window.location.href);
          ["success", "canceled", "session_id", "portal_session_id", "return_from"].forEach((k) =>
            url.searchParams.delete(k)
          );
          window.history.replaceState({}, document.title, url.toString());
        } catch {
          /* ignore history errors */
        }

        // Opportunistically refresh user profile after reconcile
        if (payload) {
          const current = await fetchMe();
          setAuthUser(current);
        }
      }
    } catch {
      /* ignore */
    }
  }, [fetchMe, setAuthUser, reconcileBillingNow]);

  /**
   * Initial bootstrap. Ensures:
   * - token refresh (if cookies set)
   * - billing reconcile
   * - load /me
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // If navigated back from Stripe, reconcile first
        await detectBillingReturnAndReconcile();
        await refreshMe();
      } finally {
        if (alive) setBootstrapped(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshMe, detectBillingReturnAndReconcile]);

  /**
   * Also reconcile on tab focus (helps when users complete purchase in another tab).
   */
  useEffect(() => {
    function onFocus() {
      // Best-effort: quick reconcile without spamming the server
      reconcileBillingNow();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reconcileBillingNow]);

  /**
   * Auth actions
   */
  const login = useCallback(
    async (email, password) => {
      const res = await api.post("/api/auth/login", { email, password }, { withCredentials: true });
      const token = res?.data?.accessToken || res?.data?.token || null;
      if (token && token !== getAccessToken()) {
        setAccessTokenState(token);
        attachAccessToken(token);
      }
      // Reconcile after login to pull latest premium status
      await reconcileBillingNow();
      const current = await fetchMe();
      setAuthUser(current);
      return current;
    },
    [fetchMe, setAuthUser, reconcileBillingNow]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post("/api/auth/register", payload, { withCredentials: true });
      const token = res?.data?.accessToken || res?.data?.token || null;
      if (token && token !== getAccessToken()) {
        setAccessTokenState(token);
        attachAccessToken(token);
      }
      // Reconcile for safety after register (in case of trial/grant)
      await reconcileBillingNow();
      const current = await fetchMe();
      setAuthUser(current);
      return current;
    },
    [fetchMe, setAuthUser, reconcileBillingNow]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", {}, { withCredentials: true });
    } catch {
      /* ignore */
    } finally {
      setAuthUser(null);
      setAccessTokenState(null);
      attachAccessToken(null);
    }
  }, [setAuthUser]);

  /**
   * Derived flags
   */
  const isPremium = useMemo(
    () => Boolean(user?.isPremium ?? user?.premium),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      isPremium,
      setUser: setAuthUser,
      setAuthUser,
      mergeUser,
      applyUserFromApi,
      accessToken,
      login,
      register,
      logout,
      refreshMe,
      refreshUser,
      reconcileBillingNow,
      bootstrapped,
    }),
    [
      user,
      isPremium,
      setAuthUser,
      mergeUser,
      applyUserFromApi,
      accessToken,
      login,
      register,
      logout,
      refreshMe,
      refreshUser,
      reconcileBillingNow,
      bootstrapped,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
// --- REPLACE END ---
