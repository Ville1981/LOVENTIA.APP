// File: client/src/pages/settings/SubscriptionSettings.jsx

// --- REPLACE START: functional subscriptions page (axios + checkout + billing portal + cancel now) ---
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import api from "../utils/axiosInstance";

/**
 * Subscriptions Page
 * - Start Premium: POST -> /billing/create-checkout-session -> redirect to Stripe Checkout.
 * - Manage Existing: POST -> /billing/create-portal-session  -> redirect to Stripe Billing Portal.
 * - Cancel Now: POST -> /billing/cancel-now                  -> cancels immediately (server talks to Stripe).
 *
 * Uses the shared Axios instance so Authorization + refresh cookies are handled automatically.
 * If your app keeps this file under a different name (e.g. SubscriptionSettings.jsx),
 * the component remains the same.
 */

const Row = ({ title, children }) => (
  <div className="border border-gray-300 rounded mb-6">
    <div className="px-3 py-2 font-semibold">{title}</div>
    <div className="px-3 py-3 border-t border-gray-200">{children}</div>
  </div>
);

const Subscriptions = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth?.() || { user: null, refreshUser: null };

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState("");

  // Try to infer premium from user object, supporting both `isPremium` and `premium`
  const isLoggedIn = !!user;
  const isPremium =
    (user && (user.isPremium === true || user.premium === true)) || false;
  const userEmail = user?.email ?? "";

  // Optional: after actions, try to refresh user/profile if context exposes a refetch
  const safeRefreshUser = useCallback(async () => {
    try {
      if (typeof refreshUser === "function") {
        await refreshUser();
      }
    } catch {
      /* no-op */
    }
  }, [refreshUser]);

  // Refetch user state when returning from checkout/portal/cancel (URL has flags)
  useEffect(() => {
    const returnedFromStripe =
      searchParams.get("success") === "1" ||
      searchParams.get("canceled") === "1" ||
      searchParams.get("portal_return") === "1" ||
      // Some routers stringify booleans:
      searchParams.get("success") === "true" ||
      searchParams.get("canceled") === "true";

    if (returnedFromStripe) {
      // Clear possible stale banners and refresh user from API/context
      setMsg("");
      setSuccess("");
      void safeRefreshUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  useEffect(() => {
    // Clear banners when user premium flips (after refetch)
    setMsg("");
    setSuccess("");
  }, [isPremium]);

  const benefits = useMemo(
    () => [
      "See who liked you",
      "3 Super Likes per week",
      "Unlimited likes & rewinds",
      "Dealbreakers feature",
      "No ads",
    ],
    []
  );

  /**
   * Extract a `{ url }` safely from backend response payloads.
   * Supports shapes like `{ url }` or `{ data: { url } }` to be tolerant.
   */
  const extractUrl = (payload) => {
    if (!payload) return null;
    if (typeof payload.url === "string") return payload.url;
    if (payload.data && typeof payload.data.url === "string") return payload.data.url;
    return null;
  };

  const clearBanners = () => {
    setMsg("");
    setSuccess("");
  };

  const friendlyError = useCallback((fallback) => {
    setSuccess("");
    setMsg(
      fallback ||
        "Billing backend is not configured yet (or you are not authenticated). Please try again after logging in."
    );
  }, []);

  const handleStartPremium = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      // NOTE: axiosInstance baseURL already ends with /api, so we omit /api here.
      const res = await api.post("/billing/create-checkout-session", {
        // Optional: let backend prefill the checkout customer email
        email: userEmail || undefined,
      });
      const url = extractUrl(res?.data);
      if (url) {
        window.location.assign(url);
      } else {
        friendlyError("Checkout session URL not returned by the server.");
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        friendlyError("Unauthorized. Please log in and try again.");
      } else if (status === 404 || status === 501) {
        friendlyError();
      } else {
        setMsg(e?.message || "Unable to start checkout right now.");
      }
    } finally {
      setBusy(false);
    }
  }, [friendlyError, isLoggedIn, navigate, userEmail]);

  const handleOpenPortal = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      const res = await api.post("/billing/create-portal-session", {});
      const url = extractUrl(res?.data);
      if (url) {
        window.location.assign(url);
      } else {
        friendlyError("Billing portal URL not returned by the server.");
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        friendlyError("Unauthorized. Please log in and try again.");
      } else if (status === 404 || status === 501) {
        friendlyError();
      } else {
        setMsg(e?.message || "Unable to open billing portal right now.");
      }
    } finally {
      setBusy(false);
    }
  }, [friendlyError, isLoggedIn, navigate]);

  /**
   * Immediate cancel, without leaving the app.
   * The backend will locate the Stripe customer from the authenticated user and cancel active/trialing subs.
   */
  const handleCancelNow = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    if (!window.confirm("Cancel your active subscription immediately? This will end access right away.")) {
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      const res = await api.post("/billing/cancel-now", {});
      const results = res?.data?.results || res?.data?.canceled || [];
      if (Array.isArray(results) && results.length > 0) {
        setSuccess("Subscription canceled immediately. Premium access will be removed.");
        await safeRefreshUser();
      } else {
        // Even if backend says none found, refresh to reflect any Stripe-side change routed via webhook
        setMsg("No active subscription was found to cancel.");
        await safeRefreshUser();
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        friendlyError("Unauthorized. Please log in and try again.");
      } else {
        setMsg(e?.response?.data?.error || e?.message || "Cancel failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }, [friendlyError, isLoggedIn, navigate, safeRefreshUser]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Subscription Settings</h1>
      <p className="text-sm text-gray-600 mb-6">
        Here you can start, manage or cancel your Premium membership. This page
        talks to your billing provider through our backend (e.g., Stripe).
      </p>

      {success && (
        <div className="mb-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
          {success}
        </div>
      )}
      {msg && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          {msg}
        </div>
      )}

      <Row title="Current Plan">
        <p>
          You are currently on the{" "}
          <strong>{isPremium ? "Premium" : "Free"}</strong> plan.
        </p>
      </Row>

      <Row title="Go Premium">
        <ul className="list-disc pl-5 mb-3 space-y-1">
          {benefits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleStartPremium}
            disabled={busy || isPremium}
            className={`px-6 py-2 rounded bg-yellow-500 text-white font-semibold hover:bg-yellow-600 transition ${
              busy || isPremium ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={isPremium ? "Already on Premium" : undefined}
          >
            {busy ? "Working…" : isPremium ? "Already Premium" : "Start Premium"}
          </button>

          <button
            type="button"
            onClick={handleOpenPortal}
            disabled={busy || !isPremium}
            className={`px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition ${
              busy || !isPremium ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={!isPremium ? "No active subscription to manage" : undefined}
          >
            {busy ? "Opening…" : "Open Billing Portal"}
          </button>

          <button
            type="button"
            onClick={handleCancelNow}
            disabled={busy || !isPremium}
            className={`px-6 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition ${
              busy || !isPremium ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={!isPremium ? "No active subscription to cancel" : undefined}
          >
            {busy ? "Canceling…" : "Cancel now"}
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          You’ll be redirected to secure checkout / portal for changes. We never store your card
          details on our servers.
        </p>
      </Row>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mt-2 text-sm underline"
      >
        ← Back
      </button>
    </div>
  );
};

export default Subscriptions;
// --- REPLACE END ---
