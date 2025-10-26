// --- REPLACE START: unified entitlements hook (isPremium from /api/me) ---
import { useQuery } from "@tanstack/react-query";
import axios from "../services/api/axiosInstance";

/**
 * Fetches current user info from /api/me using our shared axios instance.
 * Returns a stable shape with isPremium, loading and error states.
 *
 * Notes:
 * - Does NOT throw on 401; instead returns isPremium:false and exposes error.
 * - Caches for a short period to avoid spamming the endpoint.
 */

async function fetchMe() {
  try {
    const res = await axios.get("/api/me");
    // Expected shape: { user: { isPremium: boolean, ... } } OR flat { isPremium: boolean, ... }
    const data = res?.data ?? {};
    const user = data.user ?? data;
    return {
      ok: true,
      user,
      isPremium: Boolean(user?.isPremium),
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
    enabled = true,
    staleTime = 60_000,   // 1 min cache
    refetchOnWindowFocus = false,
  } = options;

  const query = useQuery({
    queryKey: ["me", "entitlements"],
    queryFn: fetchMe,
    enabled,
    staleTime,
    refetchOnWindowFocus,
  });

  const data = query.data ?? { ok: false, user: null, isPremium: false };

  return {
    // booleans for simple gating
    isPremium: Boolean(data.isPremium),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    // raw
    user: data.user,
    ok: data.ok,
    error: data.error,
    // passthrough helpers
    refetch: query.refetch,
  };
}

export default useEntitlements;
// --- REPLACE END ---
