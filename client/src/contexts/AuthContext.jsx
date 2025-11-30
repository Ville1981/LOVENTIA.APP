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
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      localStorage?.setItem?.("accessToken", token);
      localStorage?.setItem?.("token", token);
    } else {
      delete api.defaults.headers.common.Authorization;
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
 * Clear all known auth-related keys from storage.
 * This is used by both logout and hard session resets.
 */
function clearStoredTokens() {
  try {
    const keys = [
      // Newer / namespaced keys
      "loventia_accessToken",
      "loventia_refreshToken",
      "authToken",
      "user",
      // Older keys still present in storage
      "refreshToken",
      "accessToken",
      "token",
    ];

    for (const k of keys) {
      try {
        localStorage?.removeItem?.(k);
      } catch {
        /* ignore */
      }
      try {
        sessionStorage?.removeItem?.(k);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Lightweight equality to avoid unnecessary state updates.
 * NOTE: now also compares Super Like quota so UI updates when quota changes.
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

  // Super Like quota: if used or weekKey changes, treat as different user state.
  const qA =
    a.entitlements &&
    a.entitlements.quotas &&
    a.entitlements.quotas.superLikes;
  const qB =
    b.entitlements &&
    b.entitlements.quotas &&
    b.entitlements.quotas.superLikes;

  const usedA = qA && qA.used != null ? Number(qA.used) : 0;
  const usedB = qB && qB.used != null ? Number(qB.used) : 0;

  if (usedA !== usedB) return false;

  const weekA = (qA && qA.weekKey) || null;
  const weekB = (qB && qB.weekKey) || null;
  if (weekA !== weekB) return false;

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
 * Ensures entitlements object exists and includes features + quotas with safe defaults.
 */
// --- REPLACE START: normalizeUserPayload (keep entitlements.quotas.superLikes) ---
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
    copy.visibility || {
      isHidden: false,
      hiddenUntil: null,
      resumeOnLogin: true,
    };

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
  const incomingFeat =
    incomingEnt.features && typeof incomingEnt.features === "object"
      ? incomingEnt.features
      : {};

  // Quotas: keep everything from backend, but guarantee superLikes shape
  const incomingQuotas =
    incomingEnt.quotas && typeof incomingEnt.quotas === "object"
      ? incomingEnt.quotas
      : {};

  const defaultSuperLikesQuota = {
    used: 0,
    weekKey: null,
    window: "weekly",
  };

  const normalizedSuperLikesQuota =
    incomingQuotas.superLikes &&
    typeof incomingQuotas.superLikes === "object"
      ? { ...defaultSuperLikesQuota, ...incomingQuotas.superLikes }
      : defaultSuperLikesQuota;

  copy.entitlements = {
    tier: incomingEnt.tier ?? (copy.isPremium ? "premium" : "free"),
    features: { ...defaultFeatures, ...incomingFeat },
    quotas: {
      ...incomingQuotas,
      superLikes: normalizedSuperLikesQuota,
    },
  };

  return copy;
}
// --- REPLACE END: normalizeUserPayload (keep entitlements.quotas.superLikes) ---

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
  entitlements: { tier: "free", features: {}, quotas: {} },

  // super like convenience
  superLikesPerWeek: 0,
  superLikesUsed: 0,
  superLikesRemaining: 0,

  // FREE like quota (daily) – used for FREE user like-limit UI
  dailyLikeQuota: {
    limit: null,
    remaining: null,
    resetAt: null,
  },
  updateDailyLikeQuotaFromPayload: () => {},

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

  // FREE like quota (daily) – for FREE user like-limit banner
  const [dailyLikeQuota, setDailyLikeQuota] = useState({
    limit: null,
    remaining: null,
    resetAt: null,
  });

  // Keep track of current identity in this tab to avoid accidentally
  // swapping to a different user (e.g. due to a stray /me from another session).
  const identityRef = useRef({ id: null, email: null });

  // Prevent overlapping calls
  const refreshInFlightRef = useRef(null);
  const billingSyncInFlightRef = useRef(null);
  // Cooldown to avoid hammering /api/billing/sync and hitting 429
  const lastBillingSyncRef = useRef(0);

  // Update FREE like quota from /api/likes response
  const updateDailyLikeQuotaFromPayload = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return;

    // Support both flat { limit, remaining, resetAt } and nested { quota: { ... } }
    const source = payload.quota ?? payload;

    const hasNumbers =
      source &&
      typeof source.limit === "number" &&
      typeof source.remaining === "number";

    if (!hasNumbers) {
      return;
    }

    const next = {
      limit: source.limit,
      remaining: source.remaining,
      resetAt: source.resetAt ?? payload.resetAt ?? null,
    };

    setDailyLikeQuota((prev) => {
      // Avoid unnecessary updates if nothing changed
      if (
        prev &&
        prev.limit === next.limit &&
        prev.remaining === next.remaining &&
        prev.resetAt === next.resetAt
      ) {
        return prev;
      }
      return next;
    });

    if (import.meta?.env?.DEV) {
      try {
        // eslint-disable-next-line no-console
        console.debug("[AuthContext] dailyLikeQuota updated", next);
      } catch {
        /* noop */
      }
    }
  }, []);

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

  // Mirror current auth state to window for debugging multi-session issues
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__AUTH_DEBUG__ = {
        user,
        accessToken,
        email: user?.email || null,
        id: user?.id || user?._id || null,
        identity: { ...identityRef.current },
        dailyLikeQuota,
      };

      if (import.meta?.env?.DEV) {
        try {
          // eslint-disable-next-line no-console
          console.debug(
            "[AuthContext] user changed →",
            window.__AUTH_DEBUG__
          );
        } catch {
          /* noop */
        }
      }
    }
  }, [user, accessToken, dailyLikeQuota]);

  // Replace user only when it meaningfully changes.
  // Additionally, guard against switching to a *different* user id
  // inside the same tab unless explicitly allowed (login/register).
  const setAuthUser = useCallback(
    (incomingRaw, options = {}) => {
      const { allowIdentityChange = false } = options;
      const incoming = normalizeUserPayload(incomingRaw);
      if (!incoming) return;

      const incomingId = incoming.id || incoming._id || null;
      const incomingEmail = incoming.email || incoming.username || null;

      setUserState((prev) => {
        if (!incoming) return prev ?? null;

        if (prev && !allowIdentityChange) {
          const prevId = prev.id || prev._id || null;
          if (prevId && incomingId && prevId !== incomingId) {
            // Ignore payload that tries to swap to a different user
            // without an explicit login/register in this tab.
            if (import.meta?.env?.DEV) {
              try {
                // eslint-disable-next-line no-console
                console.warn(
                  "[AuthContext] Ignoring user payload with different id in current session",
                  { prevId, incomingId }
                );
              } catch {
                /* noop */
              }
            }
            return prev;
          }
        }

        const next = areUsersEffectivelyEqual(prev, incoming) ? prev : incoming;
        if (next !== prev) {
          identityRef.current = {
            id: incomingId,
            email: incomingEmail,
          };
        }
        return next;
      });
    },
    [identityRef]
  );

  // Shallow merge partial updates
  const mergeUser = useCallback((partialRaw) => {
    const partial = normalizeUserPayload(partialRaw) || partialRaw;
    setUserState((prev) => mergeDefined(prev, partial || {}));
  }, []);

  /**
   * Hard reset of client auth state.
   * Used by logout and by login/register before starting a new session.
   */
  const resetAuthState = useCallback(() => {
    setUserState(null);
    setAccessTokenState(null);
    attachAccessToken(null);
    clearStoredTokens();
    identityRef.current = { id: null, email: null };
    setDailyLikeQuota({
      limit: null,
      remaining: null,
      resetAt: null,
    });
  }, [identityRef]);

  /**
   * Load current user from preferred endpoints.
   * NEW ORDER:
   * 1) /api/auth/me  (auth module, includes entitlements/quotas)
   * 2) /api/me       (aggregated)
   * 3) /api/users/profile
   * 4) /api/users/me
   */
  const fetchMe = useCallback(async () => {
    const endpoints = [
      "/api/auth/me",
      "/api/me",
      "/api/users/profile",
      "/api/users/me",
    ];

    let lastError = null;

    for (const path of endpoints) {
      try {
        const res = await api.get(path);
        if (import.meta?.env?.DEV) {
          try {
            // eslint-disable-next-line no-console
            console.debug("[AuthContext] fetchMe source:", path);
          } catch {
            /* ignore */
          }
        }
        return normalizeUserPayload(res?.data ?? null);
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (import.meta?.env?.DEV && lastError) {
      try {
        // eslint-disable-next-line no-console
        console.warn(
          "[AuthContext] fetchMe failed, last error:",
          lastError?.message || lastError
        );
      } catch {
        /* ignore */
      }
    }

    return null;
  }, []);

  /**
   * Reconcile billing with the server (Stripe as source of truth),
   * then update user premium flag + entitlements locally.
   *
   * Guards:
   * - do nothing if there is no access token
   * - de-duplicate in-flight calls in this tab
   * - apply a small cooldown window to avoid hitting 429 from rapid-fire triggers
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

    // If we already have an in-flight sync, reuse that Promise
    if (billingSyncInFlightRef.current) {
      return billingSyncInFlightRef.current;
    }

    // Cooldown: avoid hammering /api/billing/sync when multiple triggers fire
    const now = Date.now();
    const last = lastBillingSyncRef.current || 0;
    const MIN_INTERVAL_MS = 10000; // 10s is enough to avoid burst 429s

    if (now - last < MIN_INTERVAL_MS) {
      if (import.meta?.env?.DEV) {
        try {
          // eslint-disable-next-line no-console
          console.info("[AuthContext] Billing sync skipped (cooldown)", {
            elapsedMs: now - last,
            minMs: MIN_INTERVAL_MS,
          });
        } catch {
          /* ignore */
        }
      }
      return Promise.resolve(null);
    }

    // Mark the moment we decided to start a sync
    lastBillingSyncRef.current = now;

    const task = (async () => {
      try {
        const payload = await syncBilling();
        // payload may contain: { isPremium, entitlements: { tier, features {...}, quotas {...} } }
        if (payload && typeof payload === "object") {
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
            const quotas = ent.quotas || {};
            const defaultSuperLikesQuota = {
              used: 0,
              weekKey: null,
              window: "weekly",
            };
            const mergedSuperLikes =
              quotas.superLikes && typeof quotas.superLikes === "object"
                ? { ...defaultSuperLikesQuota, ...quotas.superLikes }
                : defaultSuperLikesQuota;

            update.entitlements = {
              tier: ent.tier ?? (update.isPremium ? "premium" : "free"),
              features: { ...def, ...feat },
              quotas: {
                ...quotas,
                superLikes: mergedSuperLikes,
              },
            };
          }
          if (Object.keys(update).length) {
            setUserState((prev) => mergeDefined(prev, update));
          }
        }
        return payload;
      } catch (e) {
        try {
          // If backend rate limiter returns 429, do not treat as hard failure
          const status = e?.response?.status;
          if (status === 429) {
            // eslint-disable-next-line no-console
            console.warn(
              "[AuthContext] Billing sync hit 429 (rate limited), will rely on last known entitlements."
            );
          } else {
            // eslint-disable-next-line no-console
            console.warn(
              "[AuthContext] Billing sync failed:",
              e?.message || e
            );
          }
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
  const refreshMe = useCallback(
    async () => {
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
          // If refresh fails, clear all local auth state
          resetAuthState();
          return null;
        } finally {
          refreshInFlightRef.current = null;
        }
      })();

      refreshInFlightRef.current = task;
      return task;
    },
    [fetchMe, setAuthUser, reconcileBillingNow, resetAuthState]
  );

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
  const detectBillingReturnAndReconcile = useCallback(
    async () => {
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
    },
    [fetchMe, setAuthUser, reconcileBillingNow]
  );

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
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }
    return undefined;
  }, [reconcileBillingNow]);

  /**
   * Auth actions
   * - login/register now perform a hard reset of local auth state
   *   before establishing a new session.
   * - logout uses the same reset helper, so switching users in the
   *   same browser window will not leak the previous session.
   */
  const login = useCallback(
    async (email, password) => {
      // Always clear any previous client-side session first
      resetAuthState();

      let res;
      try {
        // Primary (confirmed in PS)
        res = await api.post(
          "/api/auth/login",
          { email, password },
          { withCredentials: true }
        );
      } catch (err) {
        // Fallback ONLY for path issues (404/405), not for bad credentials
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

      if (refreshToken) {
        try {
          localStorage?.setItem?.("refreshToken", refreshToken);
        } catch {
          /* ignore */
        }
      }

      // Immediately apply the user from login response as the new identity
      // so that later /me calls from another session cannot overwrite it.
      setAuthUser(res?.data, { allowIdentityChange: true });

      // Reconcile after login to pull latest premium status (guarded)
      await reconcileBillingNow();

      // Fetch current profile from unified endpoints
      const current = await fetchMe();
      setAuthUser(current);
      return current;
    },
    [fetchMe, setAuthUser, reconcileBillingNow, resetAuthState]
  );

  const register = useCallback(
    async (payload) => {
      // New registration should also start from a clean local state
      resetAuthState();

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

      // Apply newly registered user as the active identity
      setAuthUser(res?.data, { allowIdentityChange: true });

      await reconcileBillingNow();
      const current = await fetchMe();
      setAuthUser(current);
      return current;
    },
    [fetchMe, setAuthUser, reconcileBillingNow, resetAuthState]
  );

  const logout = useCallback(
    async () => {
      try {
        // Tell backend it can clear refresh cookie (if any)
        await api.post("/api/auth/logout", {}, { withCredentials: true });
      } catch (err) {
        try {
          // eslint-disable-next-line no-console
          console.warn(
            "[AuthContext] Logout request failed (ignored):",
            err?.message || err
          );
        } catch {
          /* ignore */
        }
      } finally {
        // Always perform hard local reset so no stale session leaks through
        resetAuthState();
      }
    },
    [resetAuthState]
  );

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
      quotas: {},
    };
    const incoming =
      user?.entitlements && typeof user.entitlements === "object"
        ? user.entitlements
        : {};
    const feat =
      incoming.features && typeof incoming.features === "object"
        ? incoming.features
        : {};
    const quotas =
      incoming.quotas && typeof incoming.quotas === "object"
        ? incoming.quotas
        : {};
    return {
      tier: incoming.tier ?? def.tier,
      features: { ...def.features, ...feat },
      quotas,
    };
  }, [user, isPremium]);

  // Convenience booleans for consumers
  const noAds = !!entitlements.features.noAds || isPremium;
  const unlimitedLikes = !!entitlements.features.unlimitedLikes;
  const unlimitedRewinds = !!entitlements.features.unlimitedRewinds;

  // --- super like derived values (for button label/disabled) ---
  const superLikesPerWeek = useMemo(
    () => Number(entitlements.features.superLikesPerWeek || 0),
    [entitlements.features.superLikesPerWeek]
  );

  const superLikesUsed = useMemo(() => {
    const raw =
      user?.entitlements?.quotas?.superLikes?.used ??
      user?.entitlements?.quotas?.superlikes?.used ??
      0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [user]);

  const superLikesRemaining = useMemo(() => {
    const remaining = superLikesPerWeek - superLikesUsed;
    return remaining > 0 ? remaining : 0;
  }, [superLikesPerWeek, superLikesUsed]);

  // --- DEBUG START: log superlike quota snapshot ---
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[AuthContext] superlike quota snapshot", {
        features: entitlements?.features,
        quotas: entitlements?.quotas?.superLikes,
        superLikesPerWeek,
        superLikesUsed,
        superLikesRemaining,
      });
    }
  }, [entitlements, superLikesPerWeek, superLikesUsed, superLikesRemaining]);
  // --- DEBUG END ---

  const value = useMemo(
    () => ({
      user,
      isPremium,
      entitlements,
      noAds,
      unlimitedLikes,
      unlimitedRewinds,

      superLikesPerWeek,
      superLikesUsed,
      superLikesRemaining,

      // FREE like quota (daily) for FREE-like UI
      dailyLikeQuota,
      updateDailyLikeQuotaFromPayload,

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
      superLikesPerWeek,
      superLikesUsed,
      superLikesRemaining,
      dailyLikeQuota,
      updateDailyLikeQuotaFromPayload,
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

