// PATH: client/src/hooks/useEntitlements.js

// --- REPLACE START: unified entitlements hook (avoid anon /api/me noise; prefer AuthContext; safe fallbacks) ---
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "../services/api/axiosInstance";
import { useAuth } from "../contexts/AuthContext";
import { isPremium as isPremiumUtil } from "../utils/entitlements";

/**
 * useEntitlements
 * - Primary source of truth: AuthContext (already normalizes /api/auth/me + /api/me + /api/users/* order).
 * - Fallback: a lightweight /api/me query, but ONLY when a token exists and/or caller explicitly enables it.
 *
 * Why:
 * - Lighthouse showed anon homepage calling /api/me and getting 403.
 *   This hook must not trigger /api/me for anonymous sessions by default.
 *
 * Notes:
 * - Does NOT throw on 401/403; instead returns isPremium:false and exposes error.
 * - Caches for a short period to avoid spamming the endpoint.
 */

function readStoredAccessToken() {
  try {
    return (
      localStorage?.getItem?.("accessToken") ||
      localStorage?.getItem?.("token") ||
      localStorage?.getItem?.("loventia_accessToken") ||
      null
    );
  } catch {
    return null;
  }
}

async function fetchMe() {
  try {
    const res = await axios.get("/api/me");
    // Expected shape: { user: { isPremium: boolean, ... } } OR flat { isPremium: boolean, ... }
    const data = res?.data ?? {};
    const user = data.user ?? data;
    return {
      ok: true,
      user,
      isPremium: Boolean(user?.isPremium ?? user?.premium),
    };
  } catch (err) {
    // Normalize error but don't explode the UI
    return {
      ok: false,
      user: null,
      isPremium: false,
      error: {
        status: err?.response?.status ?? 0,
        message: err?.response?.data?.message ?? err?.message ?? "Unknown error",
      },
    };
  }
}

export function useEntitlements(options = {}) {
  const {
    /**
     * enabled:
     * - If AuthContext is present and bootstrapped, we can safely compute entitlements locally.
     * - If AuthContext is not available (legacy usage), enabled controls whether we MAY query /api/me.
     */
    enabled = true,
    staleTime = 60_000, // 1 min cache
    refetchOnWindowFocus = false,

    /**
     * allowAnonymousFetch:
     * - If true, allows querying /api/me even when no token exists.
     * - Default false to prevent anon homepage / Lighthouse noise.
     */
    allowAnonymousFetch = false,
  } = options;

  // Prefer AuthContext whenever possible
  const auth =
    typeof useAuth === "function"
      ? useAuth()
      : { user: null, isPremium: false, bootstrapped: false, entitlements: null };

  const token = useMemo(() => readStoredAccessToken(), []);

  const canFetchMe = useMemo(() => {
    if (!enabled) return false;
    if (allowAnonymousFetch) return true;
    return Boolean(token);
  }, [enabled, allowAnonymousFetch, token]);

  // Only fetch /api/me if we actually need to (no context / not bootstrapped / legacy usage)
  const shouldQueryMe = useMemo(() => {
    // If AuthContext is ready, do not query /api/me.
    if (auth && auth.bootstrapped) return false;
    // If we already have a user in context, do not query /api/me.
    if (auth && auth.user) return false;
    // Otherwise, we may query if allowed
    return canFetchMe;
  }, [auth, canFetchMe]);

  const query = useQuery({
    queryKey: ["me", "entitlements"],
    queryFn: fetchMe,
    enabled: shouldQueryMe,
    staleTime,
    refetchOnWindowFocus,
  });

  // Prefer context-derived values
  const ctxUser = auth?.user ?? null;
  const ctxIsPremium = Boolean(auth?.isPremium ?? (ctxUser ? isPremiumUtil(ctxUser) : false));

  const apiData = query.data ?? { ok: false, user: null, isPremium: false, error: null };

  const effectiveUser = ctxUser || apiData.user;
  const effectiveIsPremium = ctxUser ? ctxIsPremium : Boolean(apiData.isPremium);

  return {
    // booleans for simple gating
    isPremium: Boolean(effectiveIsPremium),
    isLoading: Boolean(query.isLoading) && !ctxUser,
    isFetching: Boolean(query.isFetching) && !ctxUser,
    // raw
    user: effectiveUser,
    ok: ctxUser ? true : Boolean(apiData.ok),
    error: ctxUser ? null : apiData.error,
    // passthrough helpers
    refetch: query.refetch,
  };
}

export default useEntitlements;
// --- REPLACE END ---


