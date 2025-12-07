// PATH: client/src/auth/useLogout.js
// --- REPLACE START ---
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Shared axios instance for this hook.
 * NOTE: If you already centralize axios elsewhere, you can
 * later swap this to that instance, but this is safe as-is.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5000",
  withCredentials: true,
});

/**
 * Helper to safely remove keys from storage without crashing
 * if storage is not available or throws.
 */
function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug(`safeRemove(${key}) failed`, err);
    return false;
  }
}

/**
 * useLogout
 *
 * Responsibilities:
 * - Call backend POST /api/auth/logout (best-effort)
 * - Clear access tokens and user data from local/session storage
 * - Clear any global Authorization headers from axios instances
 * - Reset AuthContext state where possible (via useAuth)
 * - Clear React Query cache
 * - Navigate user to /login
 *
 * NOTE:
 * - Optional `setAuth` parameter is kept for backwards compatibility
 *   if some legacy components still inject their own auth-store setter.
 */
export function useLogout({ setAuth } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Read whatever the current AuthContext exposes.
  // We use multiple fallbacks so we do not break if the shape changes slightly.
  const auth = useAuth?.() || {};
  const authLogout =
    typeof auth.logout === "function" ? auth.logout : undefined;
  const authClear =
    typeof auth.clearAuth === "function" ? auth.clearAuth : undefined;
  const setUser =
    typeof auth.setUser === "function" ? auth.setUser : undefined;

  return async function logout() {
    // 0) Best-effort server-side logout (clear refresh cookie / server session)
    try {
      await api.post("/api/auth/logout"); // 200/204 is enough; body is not required
    } catch (err) {
      // Network / server errors on logout should not block local cleanup
      // eslint-disable-next-line no-console
      console.debug("logout: server call failed (ignored)", err);
    }

    // 1) Remove tokens and user data from storages
    safeRemove(localStorage, "accessToken");
    safeRemove(sessionStorage, "accessToken");
    safeRemove(localStorage, "user");

    // 2) Drop any global Authorization headers (both global axios and local api)
    try {
      if (axios.defaults?.headers?.common?.Authorization) {
        delete axios.defaults.headers.common.Authorization;
      }
      if (api.defaults?.headers?.common?.Authorization) {
        delete api.defaults.headers.common.Authorization;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug("logout: failed to clear axios headers", err);
    }

    // 3) Reset any external auth store passed in as prop
    if (typeof setAuth === "function") {
      try {
        setAuth({ user: null, token: null });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug("logout: setAuth handler failed", err);
      }
    }

    // 4) Reset AuthContext in the most appropriate way available
    try {
      if (authLogout) {
        // Preferred: dedicated logout function from context
        authLogout();
      } else if (authClear) {
        // Fallback: clearAuth helper from context
        authClear();
      } else if (setUser) {
        // Minimal fallback: just null-out the user
        setUser(null);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug("logout: AuthContext reset failed", err);
    }

    // 5) Clear React Query cache to avoid stale user-based data
    try {
      await qc.clear();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug("logout: react-query clear failed (ignored)", err);
    }

    // 6) Navigate to login page; replace history so Back does not jump to a protected view
    try {
      navigate("/login", { replace: true });
    } catch (err) {
      // As a final fallback, force a full page load
      // eslint-disable-next-line no-console
      console.debug("logout: SPA navigate failed, using hard redirect", err);
      window.location.assign("/login");
    }
  };
}
// --- REPLACE END ---


