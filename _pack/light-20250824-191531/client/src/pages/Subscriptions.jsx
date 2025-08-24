// File: client/src/pages/Subscriptions.jsx

// --- REPLACE START: functional subscriptions page (checkout + billing portal) ---
import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Subscriptions Page
 * - Start Premium: POST to backend -> create Checkout Session -> redirect.
 * - Manage Existing: POST to backend -> create Billing Portal Session -> redirect.
 *
 * Expected backend endpoints (adjust names if yours differ):
 *   POST /api/billing/create-checkout-session   -> { url: "https://..." }
 *   POST /api/billing/create-portal-session     -> { url: "https://..." }
 *
 * Until those exist, we show a friendly notice instead of crashing.
 */

const Row = ({ title, children }) => (
  <div className="border border-gray-300 rounded mb-6">
    <div className="px-3 py-2 font-semibold">{title}</div>
    <div className="px-3 py-3 border-t border-gray-200">{children}</div>
  </div>
);

const Subscriptions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isLoggedIn = !!user;
  const userEmail = user?.email ?? "";

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

  const postJSON = useCallback(async (url, payload = {}) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(
        `Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`
      );
      err.status = res.status;
      throw err;
    }
    return res.json();
  }, []);

  const friendlyError = useCallback((fallback) => {
    setMsg(
      fallback ||
        "Billing backend is not configured yet. Connect Stripe (or your provider) on the server."
    );
  }, []);

  const handleStartPremium = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      // Adjust the path to match your server
      const { url } = await postJSON("/api/billing/create-checkout-session", {
        email: userEmail || undefined,
      });
      if (url) {
        window.location.assign(url);
      } else {
        friendlyError("Checkout session URL not returned by the server.");
      }
    } catch (e) {
      if (e?.status === 404 || e?.status === 501) {
        friendlyError();
      } else {
        setMsg(e.message || "Unable to start checkout right now.");
      }
    } finally {
      setBusy(false);
    }
  }, [friendlyError, isLoggedIn, navigate, postJSON, userEmail]);

  const handleOpenPortal = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      // Adjust the path to match your server
      const { url } = await postJSON("/api/billing/create-portal-session");
      if (url) {
        window.location.assign(url);
      } else {
        friendlyError("Billing portal URL not returned by the server.");
      }
    } catch (e) {
      if (e?.status === 404 || e?.status === 501) {
        friendlyError();
      } else {
        setMsg(e.message || "Unable to open billing portal right now.");
      }
    } finally {
      setBusy(false);
    }
  }, [friendlyError, isLoggedIn, navigate, postJSON]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Subscription Settings</h1>
      <p className="text-sm text-gray-600 mb-6">
        Here you can start, manage or cancel your Premium membership. This page
        talks to your billing provider through our backend (e.g., Stripe).
      </p>

      {msg && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          {msg}
        </div>
      )}

      <Row title="Current Plan">
        <p>
          You are currently on the <strong>Free</strong> plan.
        </p>
      </Row>

      <Row title="Go Premium">
        <ul className="list-disc pl-5 mb-3 space-y-1">
          {benefits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={handleStartPremium}
          disabled={busy}
          className={`w-full md:w-auto px-6 py-2 rounded bg-yellow-500 text-white font-semibold hover:bg-yellow-600 transition ${
            busy ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {busy ? "Working…" : "Start Premium"}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          You’ll be redirected to secure checkout. We never store your card
          details on our servers.
        </p>
      </Row>

      <Row title="Manage Existing Subscription">
        <button
          type="button"
          onClick={handleOpenPortal}
          disabled={busy}
          className={`w-full md:w-auto px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition ${
            busy ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {busy ? "Opening…" : "Open Billing Portal"}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Update payment method, change plan, or cancel auto-renewal.
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
