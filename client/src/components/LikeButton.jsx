// File: client/src/components/LikeButton.jsx
// --- REPLACE START: new LikeButton with "unlimitedLikes" feature gate + optional free-limited mode ---
import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import FeatureGate from "./FeatureGate";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api/axiosInstance";
import { hasFeature, isPremium } from "../utils/entitlements";

/**
 * LikeButton
 * - Honors Premium feature "unlimitedLikes".
 * - If user has unlimitedLikes (or isPremium), likes are allowed without client-side cap
 *   (server still logs/guards).
 * - If NOT entitled:
 *     - allowFreeLimited=true (default): still call normal like route, let server enforce a daily cap.
 *     - allowFreeLimited=false: show CTA that routes to /settings/subscriptions instead of calling API.
 *
 * Props:
 *  - targetUserId: string (required)
 *  - className?: string
 *  - compact?: boolean
 *  - disabled?: boolean
 *  - allowFreeLimited?: boolean (default: true)
 *  - onSuccess?: (payload) => void
 *  - onError?: (error) => void
 */
export default function LikeButton({
  targetUserId,
  className = "",
  compact = false,
  disabled = false,
  allowFreeLimited = true,
  onSuccess,
  onError,
}) {
  const { user, refreshUser } = useAuth() || {};
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const entitledUnlimited = useMemo(
    () => hasFeature(user, "unlimitedLikes") || isPremium(user),
    [user]
  );

  const canClick = !busy && !disabled && !!targetUserId;

  const safeRefresh = useCallback(async () => {
    try {
      if (typeof refreshUser === "function") await refreshUser();
    } catch {
      /* noop */
    }
  }, [refreshUser]);

  const handleLike = useCallback(async () => {
    setMsg("");
    if (!canClick) return;

    // If user is not entitled to unlimited likes and free-limited mode is off → do nothing
    // (CTA branch renders separately below).
    if (!entitledUnlimited && !allowFreeLimited) return;

    setBusy(true);
    try {
      // Server should enforce daily cap when user is not premium.
      // Axios instance has baseURL '/api', so this hits POST /api/likes.
      const res = await api.post("/likes", { targetUserId });

      const ok = res?.data?.ok !== false;
      if (ok) {
        setMsg(compact ? "Liked." : "You liked this profile.");
        if (typeof onSuccess === "function") onSuccess(res?.data);
        // Optional sync in case counters/quotas changed on the server
        void safeRefresh();
      } else {
        const code = res?.data?.code || "";
        const errMsg =
          res?.data?.message ||
          res?.data?.error ||
          (code === "LIMIT_REACHED"
            ? "Daily like limit reached."
            : "Failed to like.");
        setMsg(errMsg);
        if (typeof onError === "function") onError(res?.data);
      }
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (status === 403 && code === "LIMIT_REACHED"
          ? "Daily like limit reached."
          : err?.message || "Network error.");
      setMsg(errMsg);
      if (typeof onError === "function") onError(err);
    } finally {
      setBusy(false);
    }
  }, [
    allowFreeLimited,
    canClick,
    compact,
    entitledUnlimited,
    onError,
    onSuccess,
    safeRefresh,
    targetUserId,
  ]);

  // --- UI styles ---
  const baseBtn =
    "inline-flex items-center gap-2 rounded font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2";
  const sizes = compact ? "text-sm px-3 py-1.5" : "text-base px-4 py-2";
  const palette = canClick
    ? "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-400"
    : "bg-gray-300 text-gray-700";

  // If not entitled and free-limited is OFF → show CTA link instead of button.
  if (!entitledUnlimited && !allowFreeLimited) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Link
          to="/settings/subscriptions"
          className={`${baseBtn} ${sizes} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400 ${className}`}
          title="Premium required"
        >
          <span aria-hidden>❤️</span>
          <span>Like (Premium)</span>
        </Link>
        {msg && (
          <div className="text-xs text-gray-700" role="status">
            {msg}
          </div>
        )}
      </div>
    );
  }

  // Default path: wrap the same button with a FeatureGate.
  // - Premium/unlimited → gate passes, render button.
  // - Free/limited → gate fails, fallback renders *the same* button; server caps usage.
  return (
    <div className="flex flex-col items-start gap-1">
      <FeatureGate
        feature="unlimitedLikes"
        allowPremiumBoolean={true}
        fallback={
          <button
            type="button"
            aria-label="Like"
            onClick={handleLike}
            disabled={!canClick}
            className={`${baseBtn} ${sizes} ${palette} ${className}`}
            title="Limited daily likes on Free plan"
          >
            <span aria-hidden>❤️</span>
            <span>{compact ? "Like" : "Send Like"}</span>
          </button>
        }
      >
        <button
          type="button"
          aria-label="Like"
          onClick={handleLike}
          disabled={!canClick}
          className={`${baseBtn} ${sizes} ${palette} ${className}`}
        >
          <span aria-hidden>❤️</span>
          <span>{compact ? "Like" : "Send Like"}</span>
        </button>
      </FeatureGate>

      {msg && (
        <div className="text-xs text-gray-700" role="status">
          {msg}
        </div>
      )}
    </div>
  );
}
// --- REPLACE END ---
