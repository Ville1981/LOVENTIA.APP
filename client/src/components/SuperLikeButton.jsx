// File: client/src/components/SuperLikeButton.jsx
// --- REPLACE START: new SuperLikeButton component with entitlement + weekly quota logic ---
import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import FeatureGate from "./FeatureGate";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api/axiosInstance";
import { hasFeature, isPremium } from "../utils/entitlements";

/**
 * SuperLikeButton
 * - Respects entitlements.features.superLikesPerWeek
 * - Reads current usage from entitlements.quotas.superLikes.used
 * - Optimistically updates local count; attempts to refresh user from server
 *
 * Props:
 *  - targetUserId: string (required) – whom to super like
 *  - className?: string – extra classes for the <button>
 *  - compact?: boolean – smaller visual & shorter label
 *  - showCounter?: boolean – render "x left" text beside the button
 *  - disabled?: boolean – external disable
 *  - onSuccess?: (payload) => void
 *  - onError?: (error) => void
 */
export default function SuperLikeButton({
  targetUserId,
  className = "",
  compact = false,
  showCounter = true,
  disabled = false,
  onSuccess,
  onError,
}) {
  const { user, setUser, refreshUser } = useAuth() || {};
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // ---------- helpers ----------
  const perWeek = useMemo(() => {
    const n =
      Number(user?.entitlements?.features?.superLikesPerWeek) ||
      (isPremium(user) ? 3 : 0);
    return Math.max(0, n);
  }, [user]);

  const used = useMemo(() => {
    const n = Number(user?.entitlements?.quotas?.superLikes?.used);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [user]);

  const remaining = Math.max(0, perWeek - used);
  const entitled =
    hasFeature(user, "superLikesPerWeek") || (isPremium(user) && perWeek > 0);

  const canClick = !busy && !disabled && entitled && remaining > 0 && !!targetUserId;

  // Optimistic local bump of usage (keeps UI snappy)
  const bumpLocalUsage = useCallback(() => {
    if (typeof setUser !== "function") return;
    try {
      setUser((prev) => {
        if (!prev) return prev;
        const e = { ...(prev.entitlements || {}) };
        const q = { ...(e.quotas || {}) };
        const sl = { ...(q.superLikes || {}) };
        const current = Number(sl.used) || 0;
        sl.used = current + 1;
        q.superLikes = sl;
        e.quotas = q;
        return { ...prev, entitlements: e };
      });
    } catch {
      /* noop */
    }
  }, [setUser]);

  const safeRefreshUser = useCallback(async () => {
    try {
      if (typeof refreshUser === "function") {
        await refreshUser();
      }
    } catch {
      /* noop */
    }
  }, [refreshUser]);

  // ---------- actions ----------
  const handleClick = useCallback(async () => {
    setMsg("");
    if (!canClick) {
      if (!entitled) setMsg("Premium required to use Super Likes.");
      else if (remaining <= 0) setMsg("No Super Likes left this week.");
      return;
    }
    setBusy(true);
    try {
      // API route: as requested, POST /api/superlike (axios baseURL already includes /api)
      const res = await api.post("/superlike", { targetUserId });
      // Shape tolerance: { ok, quota: { used, window }, message }
      const ok = res?.data?.ok !== false;
      if (ok) {
        bumpLocalUsage();
        // Optionally re-sync from server so weekly window/used stay precise
        void safeRefreshUser();
        setMsg(compact ? "Sent." : "Super Like sent!");
        if (typeof onSuccess === "function") onSuccess(res?.data);
      } else {
        const errMsg =
          res?.data?.message ||
          res?.data?.error ||
          "Failed to send Super Like.";
        setMsg(errMsg);
        if (typeof onError === "function") onError(errMsg);
      }
    } catch (err) {
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Network error.";
      setMsg(errMsg);
      if (typeof onError === "function") onError(err);
    } finally {
      setBusy(false);
    }
  }, [
    bumpLocalUsage,
    canClick,
    compact,
    entitled,
    onError,
    onSuccess,
    remaining,
    safeRefreshUser,
    targetUserId,
  ]);

  // ---------- render ----------
  const baseBtn =
    "inline-flex items-center gap-2 rounded font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2";
  const sizes = compact ? "text-sm px-3 py-1.5" : "text-base px-4 py-2";
  const palette = canClick
    ? "bg-fuchsia-600 hover:bg-fuchsia-700 text-white focus:ring-fuchsia-400"
    : "bg-gray-300 text-gray-700 cursor-not-allowed";

  const ButtonEl = (
    <button
      type="button"
      aria-label="Send Super Like"
      onClick={handleClick}
      disabled={!canClick}
      className={`${baseBtn} ${sizes} ${palette} ${className}`}
    >
      <span aria-hidden>⭐</span>
      <span>{compact ? "Super" : "Super Like"}</span>
      {showCounter && (
        <span className="ml-1 text-xs opacity-90">
          ({Math.max(0, remaining - (busy ? 1 : 0))} left)
        </span>
      )}
    </button>
  );

  // Gate the feature; show upgrade CTA as fallback
  return (
    <div className="flex flex-col items-start gap-1">
      <FeatureGate
        feature="superLikesPerWeek"
        // Treat legacy isPremium as allowed; the helper already handles it.
        fallback={
          <Link
            to="/settings/subscriptions"
            className={`${baseBtn} ${sizes} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400 ${className}`}
            title="Premium required"
          >
            <span aria-hidden>⭐</span>
            <span>Super Like (Premium)</span>
          </Link>
        }
      >
        {ButtonEl}
      </FeatureGate>

      {/* Inline helper text / status */}
      {msg && (
        <div className="text-xs text-gray-700" role="status">
          {msg}
        </div>
      )}
    </div>
  );
}
// --- REPLACE END ---
