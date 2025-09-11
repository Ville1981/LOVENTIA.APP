// File: client/src/pages/Intros.jsx
// --- REPLACE START: premium-gated Intros page (canSendIntro/intros) ---
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";

import api from "../services/api/axiosInstance";
import FeatureGate from "../components/FeatureGate";
import { useAuth } from "../contexts/AuthContext";
import { hasFeature, isPremium } from "../utils/entitlements";

/**
 * Intros (Premium)
 * - Shows incoming intros and allows starting a new intro.
 * - UI is gated: only Premium (or users with feature flag) can start/send intros.
 * - Feature keys supported: "intros" and "canSendIntro" (both treated as allow).
 */
export default function Intros() {
  const { user, refreshUser } = useAuth() || {};
  const [intros, setIntros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Entitlement check (tolerant to either feature key, or premium boolean)
  const entitled =
    hasFeature(user, "intros") ||
    hasFeature(user, "canSendIntro") ||
    isPremium(user);

  // Load intros only when entitled (avoid 403 noise)
  useEffect(() => {
    let alive = true;
    const fetchIntros = async () => {
      if (!entitled) return;
      setLoading(true);
      setStatus("");
      try {
        const res = await api.get("/intros"); // Backend route expected
        const list = Array.isArray(res?.data) ? res.data : res?.data?.items || [];
        if (alive) setIntros(list);
      } catch (err) {
        console.error("[Intros] load failed:", err?.response?.data || err);
        if (alive) setStatus("Failed to load intros.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchIntros();
    return () => {
      alive = false;
    };
  }, [entitled]);

  const handleStartIntro = useCallback(
    async (targetUserId) => {
      setStatus("");
      if (!entitled) {
        setStatus("Premium required to start intros.");
        return;
      }
      if (!targetUserId) {
        setStatus("Missing target user.");
        return;
      }
      try {
        const res = await api.post("/intros/start", { targetUserId });
        // Optional: refresh user to keep any quotas/flags up to date
        try {
          await refreshUser?.();
        } catch {
          /* ignore */
        }
        setStatus(res?.data?.message || "Intro started.");
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to start intro.";
        setStatus(msg);
      }
    },
    [entitled, refreshUser]
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">✉️ Intros</h1>

      {/* Gate the entire page content. Legacy/premium boolean is allowed by FeatureGate. */}
      <FeatureGate
        user={user}
        feature="intros"
        // Also accept deployments using "canSendIntro" as the key
        onDeny={() => void 0}
        fallback={
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-center">
            <p className="mb-2">
              This feature is available for <strong>Premium</strong> members.
            </p>
            <Link
              to="/settings/subscriptions"
              className="inline-block px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
            >
              Upgrade to Premium
            </Link>
          </div>
        }
      >
        {/* Premium-only content */}
        {loading && <p>Loading intros...</p>}
        {!loading && status && (
          <p className="text-sm text-gray-700 mb-3" role="status">
            {status}
          </p>
        )}

        {!loading && !intros.length && (
          <p className="text-gray-600">No intros yet. Start one!</p>
        )}

        <div className="space-y-4">
          {intros.map((intro) => (
            <div key={intro._id || intro.id} className="p-3 border rounded bg-white shadow">
              <p className="mb-1">
                <strong>{intro.fromUser?.username || intro.fromUser?.name || "Someone"}</strong>
                {" → "}
                <span className="text-gray-800">{intro.message || "(no message)"}</span>
              </p>
              {intro.createdAt && (
                <p className="text-xs text-gray-500">
                  {new Date(intro.createdAt).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Action: start intro (demo control) */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => handleStartIntro("demoUserId")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            ➕ Start Intro
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Demo action targets a placeholder user. Wire this to your user card.
          </p>
        </div>
      </FeatureGate>
    </div>
  );
}
// --- REPLACE END ---

















