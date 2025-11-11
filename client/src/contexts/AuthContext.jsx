// PATH: client/src/contexts/AuthContext.jsx

// --- REPLACE START: expose premium features (noAds/unlimited*) via AuthContext + keep robust login/refresh/sync flow ---
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";

// Internal API helpers (order matters for ESLint import/order)
import { syncBilling } from "../api/billing";
import api, {
  attachAccessToken as _attachAccessToken,
  getAccessToken as _getAccessToken,
} from "../api/axios.js";

/**
 * Token helpers
 * - Prefer named helpers from axios (exported there),
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
      localStorage?.setItem?.("token", token);
    } else {
      delete api.defaults.headers.common["Authorization"];
      localStorage?.removeItem?.("accessToken");
      localStorage?.removeItem?.("token");
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
    return (
      localStorage?.getItem?.("accessToken") ||
      localStorage?.getItem?.("token") ||
      null
    );
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
 * Ensures entitlements object exists and includes features with safe defaults.
 */
function normalizeUserPayload(raw) {
  const u = raw?.user ?? raw ?? null;
  if (!u || typeof u !== "object") return null;
  const copy = { ...u };

  // Mirror single image
  if (copy.profilePhoto && !copy.profilePicture)
    copy.profilePicture = copy.profilePhoto;
  if (copy.profilePicture && !copy.profilePhoto)
    copy.profilePhoto = copy.profilePicture;

  // Ensure arrays
  if (!Array.isArray(copy.photos))
    copy.photos = copy.photos ? [copy.photos].filter(Boolean) : [];
  if (!Array.isArray(copy.extraImages)) {
    copy.extraImages = copy.extraImages
      ? [copy.extraImages].filter(Boolean)
      : copy.photos;
  }
  if (copy.photos.length && !copy.extraImages.length)
    copy.extraImages = [...copy.photos];
  if (copy.extraImages.length && !copy.photos.length)
    copy.photos = [...copy.extraImages];

  // Visibility defaults
  copy.visibility =
    copy.visibility || { isHidden: false, hiddenUntil: null, resumeOnLogin: true };

  // Normalize premium flag
  copy.isPremium = Boolean(copy.isPremium ?? copy.premium);

  // Ensure entitlements + feature flags exist with sensible defaults
  const defaultFeatures = {
    noAds: false,
    unlimitedLikes: false,
    unlimitedRewinds: false,
    seeLikedYou: false,
    dealbreakers: false,
    qaVisibilityAll: false,
    introsMessaging: false,
    superLikesPerWeek: 0,
  };
  const incomingEnt = copy.entitlements || {};
  const incomingFeat = (incomingEnt.features && typeof incomingEnt.features === "object")
    ? incomingEnt.features
    : {};
  copy.entitlements = {
    tier: incomingEnt.tier ?? (copy.isPremium ? "premium" : "free"),
    features: { ...defaultFeatures, ...incomingFeat },
  };

  return copy;
}

/**
 * Context shape
 */
const AuthContext = createContext({
  user: null,
  isPremium: false,
  // convenience feature flags
  noAds: false,
  unlimitedLikes: false,
  unlimitedRewinds: false,
  entitlements: { tier: "free", features: {} },

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

  // Prevent overlapping calls
  const refreshInFlightRef = useRef(null);
  const billingSyncInFlightRef = useRef(null);

  // Keep axios header in sync when token changes
  useEffect(() => {
    attachAccessToken(accessToken);
    if (import.meta?.env?.DEV) {
      try {
        // eslint-disable-next-line no-console
        console.info("[AuthContext] token updated:", Boolean(accessToken));
      } catch {
        /* noop */
      }
    }
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
   * Order chosen to match what we observed in PS:
   * 1) /api/me
   * 2) /api/users/profile
   * 3) /api/auth/me
   * 4) /api/users/me
   */
  const fetchMe = useCallback(async () => {
    // 1) /api/me
    try {
      const r0 = await api.get("/api/me");
      return normalizeUserPayload(r0?.data ?? null);
    } catch {
      /* continue */
    }

    // 2) /api/users/profile
    try {
      const r1 = await api.get("/api/users/profile");
      return normalizeUserPayload(r1?.data ?? null);
    } catch {
      /* continue */
    }

    // 3) /api/auth/me
    try {
      const r2 = await api.get("/api/auth/me");
      return normalizeUserPayload(r2?.data ?? null);
    } catch {
      /* continue */
    }

    // 4) /api/users/me
    try {
      const r3 = await api.get("/api/users/me");
      return normalizeUserPayload(r3?.data ?? null);
    } catch {
      /* final fail */
    }

    return null;
  }, []);

  /**
   * Reconcile billing with the server (Stripe as source of truth),
   * then update user premium flag + entitlements locally.
   * Guard: do nothing if there is no access token to avoid spam.
   */
  const reconcileBillingNow = useCallback(async () => {
    const hasToken = !!getAccessToken();
    if (!hasToken) {
      try {
        // eslint-disable-next-line no-console
        console.warn("[AuthContext] Billing sync skipped: no access token.");
      } catch {
        /* ignore */
      }
      return null;
    }

    // De-duplicate in-flight
    if (billingSyncInFlightRef.current) return billingSyncInFlightRef.current;

    const task = (async () => {
      try {
        const payload = await syncBilling();
        // payload may contain: { isPremium, entitlements: { tier, features {...} } }
        if (payload && (typeof payload === "object")) {
          const update = {};
          if (typeof payload.isPremium === "boolean") {
            update.isPremium = payload.isPremium;
          }
          if (payload.entitlements && typeof payload.entitlements === "object") {
            // merge features with defaults to avoid missing keys
            const def = {
              noAds: false,
              unlimitedLikes: false,
              unlimitedRewinds: false,
              seeLikedYou: false,
              dealbreakers: false,
              qaVisibilityAll: false,
              introsMessaging: false,
              superLikesPerWeek: 0,
            };
            const ent = payload.entitlements || {};
            const feat = ent.features || {};
            update.entitlements = {
              tier: ent.tier ?? (update.isPremium ? "premium" : "free"),
              features: { ...def, ...feat },
            };
          }
          if (Object.keys(update).length) {
            setUserState((prev) => mergeDefined(prev, update));
          }
        }
        return payload;
      } catch (e) {
        try {
          // eslint-disable-next-line no-console
          console.warn("[AuthContext] Billing sync failed:", e?.message || e);
        } catch {
          /* ignore */
        }
        return null;
      } finally {
        billingSyncInFlightRef.current = null;
      }
    })();

    billingSyncInFlightRef.current = task;
    return task;
  }, []);

  /**
   * Refresh access token and then load /me.
   * Supports BOTH:
   *  - cookie-based: POST /api/auth/refresh {}
   *  - body-based:   POST /api/auth/refresh { refreshToken }
   */
  const refreshMe = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const task = (async () => {
      try {
        let nextToken = null;

        // 1) Try cookie-based refresh (original)
        try {
          const r = await api.post(
            "/api/auth/refresh",
            {},
            { withCredentials: true }
          );
          nextToken = r?.data?.accessToken || r?.data?.token || null;
        } catch (err1) {
          // 2) If cookie refresh fails, try body-based refresh using stored refreshToken (if any)
          try {
            const storedRefresh =
              localStorage?.getItem?.("refreshToken") ||
              sessionStorage?.getItem?.("refreshToken") ||
              null;
            if (storedRefresh) {
              const r2 = await api.post(
                "/api/auth/refresh",
                { refreshToken: storedRefresh },
                { withCredentials: true }
              );
              nextToken = r2?.data?.accessToken || r2?.data?.token || null;
            } else {
              // rethrow original
              throw err1;
            }
          } catch {
            // ignore, user might be anonymous
          }
        }

        if (nextToken && nextToken !== getAccessToken()) {
          attachAccessToken(nextToken);
          setAccessTokenState(nextToken);
        }

        // Reconcile after refresh
        await reconcileBillingNow();

        // Fetch user profile
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
   */
  const detectBillingReturnAndReconcile = useCallback(async () => {
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const hasCheckoutFlag =
        qs.has("success") || qs.has("canceled") || qs.has("session_id");
      const hasPortalFlag =
        qs.has("return_from") || qs.has("portal_session_id");

      if (hasCheckoutFlag || hasPortalFlag) {
        const payload = await reconcileBillingNow();

        try {
          const url = new URL(window.location.href);
          [
            "success",
            "canceled",
            "session_id",
            "portal_session_id",
            "return_from",
          ].forEach((k) => url.searchParams.delete(k));
          window.history.replaceState({}, document.title, url.toString());
        } catch {
          /* ignore */
        }

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
   * Initial bootstrap.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
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
   * Also reconcile on tab focus.
   */
  useEffect(() => {
    function onFocus() {
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
      let res;
      try {
        // ✅ primary (confirmed in PS)
        res = await api.post(
          "/api/auth/login",
          { email, password },
          { withCredentials: true }
        );
      } catch (err) {
        // fallback ONLY for path issues (404/405), not for bad credentials
        const status = err?.response?.status;
        if (status === 404 || status === 405) {
          res = await api.post(
            "/api/users/login",
            { email, password },
            { withCredentials: true }
          );
        } else {
          throw err;
        }
      }

      const token = res?.data?.accessToken || res?.data?.token || null;
      const refreshToken =
        res?.data?.refreshToken || res?.data?.refresh_token || null;

      if (token && token !== getAccessToken()) {
        setAccessTokenState(token);
        attachAccessToken(token);
      }
      // store refresh token if present (for body-based refresh)
      if (refreshToken) {
        try {
          localStorage?.setItem?.("refreshToken", refreshToken);
        } catch {
          /* ignore */
        }
      }

      // Reconcile after login to pull latest premium status (guarded)
      await reconcileBillingNow();

      // Fetch current profile from unified endpoints
      const current = await fetchMe();
      setAuthUser(current);
      return current;
    },
    [fetchMe, setAuthUser, reconcileBillingNow]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post("/api/auth/register", payload, {
        withCredentials: true,
      });
      const token = res?.data?.accessToken || res?.data?.token || null;
      const refreshToken =
        res?.data?.refreshToken || res?.data?.refresh_token || null;

      if (token && token !== getAccessToken()) {
        setAccessTokenState(token);
        attachAccessToken(token);
      }
      if (refreshToken) {
        try {
          localStorage?.setItem?.("refreshToken", refreshToken);
        } catch {
          /* ignore */
        }
      }

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
      try {
        localStorage?.removeItem?.("refreshToken");
      } catch {
        /* ignore */
      }
    }
  }, [setAuthUser]);

  /**
   * Derived flags + normalized entitlements for consumers
   */
  const isPremium = useMemo(
    () => Boolean(user?.isPremium ?? user?.premium),
    [user]
  );

  const entitlements = useMemo(() => {
    const def = {
      tier: isPremium ? "premium" : "free",
      features: {
        noAds: false,
        unlimitedLikes: false,
        unlimitedRewinds: false,
        seeLikedYou: false,
        dealbreakers: false,
        qaVisibilityAll: false,
        introsMessaging: false,
        superLikesPerWeek: 0,
      },
    };
    const incoming = user?.entitlements && typeof user.entitlements === "object"
      ? user.entitlements
      : {};
    const feat = incoming.features && typeof incoming.features === "object"
      ? incoming.features
      : {};
    return {
      tier: incoming.tier ?? def.tier,
      features: { ...def.features, ...feat },
    };
  }, [user, isPremium]);

  // Convenience booleans for consumers
  const noAds = !!entitlements.features.noAds || isPremium;
  const unlimitedLikes = !!entitlements.features.unlimitedLikes;
  const unlimitedRewinds = !!entitlements.features.unlimitedRewinds;

  const value = useMemo(
    () => ({
      user,
      isPremium,
      entitlements,
      noAds,
      unlimitedLikes,
      unlimitedRewinds,

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
      entitlements,
      noAds,
      unlimitedLikes,
      unlimitedRewinds,
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


