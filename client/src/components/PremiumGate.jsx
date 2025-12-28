// PATH: client/src/components/PremiumGate.jsx
// File: client/src/components/PremiumGate.jsx

// --- REPLACE START: PremiumGate – reusable feature gate & upsell for Premium ---
import React, { useCallback, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
// NOTE: matches your actual folder: "src/contexts/AuthContext.jsx"
import { useAuth } from "../contexts/AuthContext";

// --- REPLACE START: prefer shared Axios instance (baseURL + interceptors) ---
// If your tree still uses ../utils/axiosInstance elsewhere, this is safe here.
// The shared one typically has baseURL that already includes `/api`.
import api from "../services/api/axiosInstance";
// --- REPLACE END ---

/**
 * PremiumGate
 * - Wrap any Premium-only UI. If the user is not premium, shows a small lock overlay or a full-blocker.
 * - Props:
 *    • children: gated content
 *    • fallback: React node shown when locked (if provided, replaces default lock card)
 *    • mode: "inline" | "block" (default "inline")
 *       - "inline": render children dimmed with a small lock overlay button
 *       - "block" : hide children and render a full call-to-action card
 *    • requireFeature: optional feature key to check in entitlements.features (e.g., "seeLikedYou")
 *    • onUpgraded: callback after successful sync/upgrade
 *
 * Gate condition (normalized):
 *   isPremiumTier = user.entitlements?.tier === 'premium' OR legacy flags
 *   If requireFeature is given:
 *      - PREMIUM TIER ALWAYS UNLOCKS (even if features object missing)
 *      - Otherwise require features[requireFeature] === true
 */
export default function PremiumGate({
  children,
  fallback = null,
  mode = "inline",
  requireFeature = "",
  onUpgraded,
}) {
  const { user, refreshMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // --- REPLACE START: small dedupe/cooldown to avoid hammering billing endpoints ---
  const ranAtRef = useRef({ sync: 0, checkout: 0 });

  const safeSessionGet = (key) => {
    try {
      if (typeof window === "undefined") return null;
      return window.sessionStorage ? sessionStorage.getItem(key) : null;
    } catch {
      return null;
    }
  };

  const safeSessionSet = (key, value) => {
    try {
      if (typeof window === "undefined") return;
      if (window.sessionStorage) sessionStorage.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  };

  /**
   * Post helper:
   * - First tries "/billing/..." (assuming axios baseURL already includes "/api")
   * - If server responds 404, retries "/api/billing/..." as a compatibility fallback
   * This avoids accidental "/api/api" double-prefix issues depending on which axios instance is used.
   */
  const postBilling = async (path, body) => {
    try {
      return await api.post(path, body);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404 && typeof path === "string" && !path.startsWith("/api/")) {
        return await api.post(`/api${path}`, body);
      }
      throw e;
    }
  };

  const formatRateLimitMessage = (resp) => {
    const reset = resp?.data?.reset; // epoch ms
    const msLeft = typeof reset === "number" ? Math.max(0, reset - Date.now()) : 0;
    const secLeft = msLeft ? Math.ceil(msLeft / 1000) : null;

    return secLeft
      ? `Too many requests. Please wait ${secLeft}s and try again.`
      : "Too many requests. Please slow down and try again.";
  };
  // --- REPLACE END ---

  // Determine if the account has Premium tier
  const isPremiumTier = useMemo(() => {
    const tierPremium = user?.entitlements?.tier === "premium";
    const legacy = user?.isPremium === true || user?.premium === true;
    return Boolean(tierPremium || legacy);
  }, [user]);

  // Determine if a specific feature is available (if requested)
  const hasFeature = useMemo(() => {
    if (!requireFeature) return true; // no specific feature required
    // If account is Premium tier, pass even if features not populated yet
    if (isPremiumTier) return true;
    const f = user?.entitlements?.features || {};
    return f[requireFeature] === true;
  }, [isPremiumTier, requireFeature, user]);

  const unlocked = isPremiumTier && hasFeature;

  // Sync button: ask backend to reconcile with Stripe, then refresh /me
const handleSync = useCallback(async () => {
  setErr("");

  // --- REPLACE START: cooldown + sessionStorage dedupe for sync button ---
  const now = Date.now();
  if (now - (ranAtRef.current.sync || 0) < 1500) return; // prevent double-click bursts
  ranAtRef.current.sync = now;

  const dedupeKey = "billing_sync_gate:last";
  const last = Number(safeSessionGet(dedupeKey) || 0);
  if (last && now - last < 2500) return; // avoid rapid repeats across rerenders
  safeSessionSet(dedupeKey, String(now));
  // --- REPLACE END ---
  setBusy(true);
  try {
    // IMPORTANT:
    // refreshMe() already:
    //  - refreshes token (if needed)
    //  - reconciles billing (calls /billing/sync with cooldown/in-flight guards)
    //  - fetches /me
    const me = await refreshMe();

    if (!me) {
      setErr("You are not logged in. Please log in and try Sync again.");
      return;
    }

    if (typeof onUpgraded === "function") onUpgraded(me);
  } catch (e) {
    const resp = e?.response;
    if (resp?.status === 401) {
      setErr("You are not logged in. Please log in and try Sync again.");
    } else if (resp?.status === 429) {
      setErr(formatRateLimitMessage(resp));
    } else {
      setErr("Sync failed. Please try again.");
    }
  } finally {
    setBusy(false);
  }
}, [onUpgraded, refreshMe, safeSessionGet, safeSessionSet]);

  // Checkout button: open Stripe Checkout session
  const handleCheckout = useCallback(async () => {
    setErr("");

    // --- REPLACE START: cooldown for checkout button ---
    const now = Date.now();
    if (now - (ranAtRef.current.checkout || 0) < 1500) return;
    ranAtRef.current.checkout = now;
    // --- REPLACE END ---

    setBusy(true);
    try {
      // --- REPLACE START: call create-checkout-session without hardcoding "/api" prefix ---
      const res = await postBilling("/billing/create-checkout-session", {});
      // --- REPLACE END ---

      const url = res?.data?.url || res?.data?.data?.url;
      if (url) {
        window.location.assign(url);
        return;
      }
      setErr("Could not open checkout.");
    } catch (e) {
      // --- REPLACE START: show clear 401/429 messages ---
      const resp = e?.response;
      if (resp?.status === 401) {
        setErr("You are not logged in. Please log in and try again.");
      } else if (resp?.status === 429) {
        setErr(formatRateLimitMessage(resp));
      } else {
        setErr("Checkout could not be created.");
      }
      // --- REPLACE END ---
    } finally {
      setBusy(false);
    }
  }, [postBilling]);

  // If unlocked, simply render children
  if (unlocked) {
    return <>{children}</>;
  }

  // If caller provided a custom fallback, show it as-is
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default lock UIs
  if (mode === "block") {
    // Full CTA card (replaces content)
    return (
      <div className="w-full max-w-3xl mx-auto">
        <div className="border border-gray-200 rounded-xl shadow-sm p-6 bg-white">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              🔒
            </span>
            <div>
              <h3 className="text-lg font-semibold">Premium feature</h3>
              <p className="text-sm text-gray-600">
                Unlock this section with Premium. If you already subscribed, press Sync.
              </p>
            </div>
          </div>

          {requireFeature ? (
            <p className="mt-3 text-sm text-gray-500">
              Required feature: <span className="font-medium">{requireFeature}</span>
            </p>
          ) : null}

          {err ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {err}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCheckout}
              disabled={busy}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Opening…" : "Unlock Premium"}
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={busy}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-60"
            >
              {busy ? "Syncing…" : "I already subscribed – Sync"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // "inline" mode: show children dimmed with a small overlay CTA
  return (
    <div className="relative">
      {/* NOTE: keep dimming; do not disable pointer events unless caller wants full block */}
      <div className="opacity-50">{children}</div>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl shadow p-4 max-w-md mx-auto text-center">
          <div className="text-2xl mb-1">🔒</div>
          <p className="text-sm text-gray-700">This is a Premium feature. Unlock to continue.</p>

          {requireFeature ? (
            <p className="mt-1 text-xs text-gray-500">
              Required: <span className="font-medium">{requireFeature}</span>
            </p>
          ) : null}

          {err ? (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {err}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={handleCheckout}
              disabled={busy}
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Opening…" : "Unlock"}
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={busy}
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-60"
            >
              {busy ? "Syncing…" : "Sync"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

PremiumGate.propTypes = {
  children: PropTypes.node,
  fallback: PropTypes.node,
  mode: PropTypes.oneOf(["inline", "block"]),
  requireFeature: PropTypes.string,
  onUpgraded: PropTypes.func,
};
// --- REPLACE END ---

