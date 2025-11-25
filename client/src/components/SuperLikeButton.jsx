// File: client/src/components/SuperLikeButton.jsx

// --- REPLACE START: new SuperLikeButton component with entitlement + weekly quota logic ---
import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
 *  - showCounter?: boolean – render "used / total" text beside the button
 *  - disabled?: boolean – external disable
 *  - onSuccess?: (payload) => void
 *  - onError?: (error) => void
 *
 * (SL-UI2)
 *  - Shows a short success message after Super Like is sent.
 *  - When weekly quota is exhausted, shows a clear message:
 *    * Free:    "You have used your weekly Super Like. Upgrade to Premium for more."
 *    * Premium: "You have used all your Super Likes for this week. They reset on Monday."
 *  - All user-facing texts now go through i18n with English defaults.
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
  const { t } = useTranslation();
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
  const displayUsed = Math.min(used, perWeek);
  const entitled =
    hasFeature(user, "superLikesPerWeek") || (isPremium(user) && perWeek > 0);

  const canClick =
    !busy && !disabled && entitled && remaining > 0 && !!targetUserId;

  // Optimistic local bump of usage (keeps UI snappy)
  const bumpLocalUsage = useCallback(() => {
    if (typeof setUser !== "function") return;
    try {
      setUser((prev) => {
        if (!prev) return prev;

        const entitlements = { ...(prev.entitlements || {}) };
        const quotas = { ...(entitlements.quotas || {}) };
        const superLikes = { ...(quotas.superLikes || {}) };

        const current = Number(superLikes.used) || 0;
        superLikes.used = current + 1;

        quotas.superLikes = superLikes;
        entitlements.quotas = quotas;

        return { ...prev, entitlements };
      });
    } catch {
      // no-op
    }
  }, [setUser]);

  const safeRefreshUser = useCallback(async () => {
    try {
      if (typeof refreshUser === "function") {
        await refreshUser();
      }
    } catch {
      // no-op
    }
  }, [refreshUser]);

  // Helper: quota exhausted message (SL-UI2)
  const getQuotaExhaustedMessage = useCallback(() => {
    if (isPremium(user)) {
      return t(
        "premium.superLike.quotaPremiumExhausted",
        "You have used all your Super Likes for this week. They reset on Monday."
      );
    }
    return t(
      "premium.superLike.quotaFreeExhausted",
      "You have used your weekly Super Like. Upgrade to Premium for more."
    );
  }, [t, user]);

  // ---------- actions ----------
  const handleClick = useCallback(async () => {
    setMsg("");

    if (!canClick) {
      if (!entitled) {
        setMsg(
          t(
            "premium.superLike.premiumRequired",
            "Premium required to use Super Likes."
          )
        );
      } else if (remaining <= 0) {
        setMsg(getQuotaExhaustedMessage());
      }
      return;
    }

    setBusy(true);
    try {
      // API route: POST /api/superlikes  (axios baseURL already includes /api)
      // Backend expects body: { targetId: <ObjectId> }
      const res = await api.post("/superlikes", { targetId: targetUserId });

      // Shape tolerance: { ok, remaining, limit, resetAt, error/message? }
      const ok = res?.data?.ok !== false;
      if (ok) {
        bumpLocalUsage();
        // Optionally re-sync from server so weekly window/used stay precise
        void safeRefreshUser();
        setMsg(
          compact
            ? t("premium.superLike.sentCompact", "Sent.")
            : t("premium.superLike.sent", "Super Like sent \u2728")
        );
        if (typeof onSuccess === "function") {
          onSuccess(res?.data);
        }
      } else {
        const errMsg =
          res?.data?.message ||
          res?.data?.error ||
          t("premium.superLike.failed", "Failed to send Super Like.");
        setMsg(errMsg);
        if (typeof onError === "function") {
          onError(errMsg);
        }
      }
    } catch (err) {
      // 429 → quota exhausted (SL-UI2)
      if (err?.response?.status === 429) {
        const quotaMsg = getQuotaExhaustedMessage();
        setMsg(quotaMsg);
        if (typeof onError === "function") {
          onError(quotaMsg);
        }
      } else {
        const errMsg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          t("premium.superLike.networkError", "Network error.");
        setMsg(errMsg);
        if (typeof onError === "function") {
          onError(err);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [
    bumpLocalUsage,
    canClick,
    compact,
    entitled,
    getQuotaExhaustedMessage,
    onError,
    onSuccess,
    remaining,
    safeRefreshUser,
    t,
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
      aria-label={t(
        "premium.superLike.ariaLabel",
        "Send Super Like"
      )}
      onClick={handleClick}
      disabled={!canClick}
      className={`${baseBtn} ${sizes} ${palette} ${className}`}
    >
      <span aria-hidden>⭐</span>
      <span>
        {compact
          ? t("premium.superLike.buttonCompactLabel", "Super")
          : t("premium.superLike.buttonLabel", "Super Like")}
      </span>
      {showCounter && perWeek > 0 && (
        <span className="ml-1 text-xs opacity-90">
          {t(
            "premium.superLike.counterLabel",
            "({{used}}/{{limit}} this week)",
            {
              used: displayUsed,
              limit: perWeek,
            }
          )}
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
            title={t(
              "premium.superLike.premiumRequiredTitle",
              "Premium required"
            )}
          >
            <span aria-hidden>⭐</span>
            <span>
              {t(
                "premium.superLike.premiumCtaLabel",
                "Super Like (Premium)"
              )}
            </span>
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


