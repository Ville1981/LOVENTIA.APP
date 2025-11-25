// PATH: client/src/components/RewindButton.jsx

// --- REPLACE START: fix FeatureGate import + use shared axiosInstance, keep rewind logic intact ---
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";

// FeatureGate is in the same components directory: client/src/components/FeatureGate.jsx
import FeatureGate from "./FeatureGate";
import { useAuth } from "../contexts/AuthContext";
// Use the shared axios instance (client/src/services/api/axiosInstance.js)
import api from "../services/api/axiosInstance";

/**
 * RewindButton
 * - Undo last "pass"/"like".
 * - Premium with "unlimitedRewinds" can always try; Free sees upgrade CTA.
 *
 * Props:
 *  - className?: string
 *  - compact?: boolean
 *  - disabled?: boolean
 *  - onSuccess?: (payload) => void
 *  - onError?: (error) => void
 */
export default function RewindButton({
  className = "",
  compact = false,
  disabled = false,
  onSuccess,
  onError,
}) {
  const { refreshUser } = useAuth() || {};
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const tryRewindOnce = async (path) => {
    // Axios instance uses '/api' baseURL, so these hit /api/<path>
    return api.post(path, {});
  };

  const handleRewind = useCallback(
    async () => {
      if (busy || disabled) return;

      setBusy(true);
      setMsg("");

      try {
        let res;

        try {
          // Primary endpoint
          res = await tryRewindOnce("/rewind");
        } catch (e1) {
          // If route missing, try alias
          const status = e1?.response?.status;
          if (status === 404) {
            res = await tryRewindOnce("/likes/rewind");
          } else {
            throw e1;
          }
        }

        const payload = res?.data;
        const ok = payload?.ok !== false;

        if (ok) {
          // Simple user-facing message
          setMsg(compact ? "Rewound." : "Last action undone.");

          // Log to console to help debugging and future diagnostics
          console.log("[RewindButton] Rewind successful payload:", payload);

          // Notify parent callback if provided
          if (typeof onSuccess === "function") {
            try {
              onSuccess(payload);
            } catch (callbackError) {
              console.error(
                "[RewindButton] onSuccess callback threw an error:",
                callbackError
              );
            }
          }

          // IMPORTANT: broadcast a window-level event with detail for deck listeners.
          // We include multiple key aliases so existing and future listeners can use
          // the one they expect (userId, targetUserId, targetId, id).
          try {
            const targetUserId =
              payload?.targetUserId ||
              payload?.targetId ||
              payload?.data?.targetUserId ||
              null;

            const detail = {
              // Primary identifiers
              targetUserId,
              targetId: payload?.targetId || targetUserId || null,

              // Common aliases for safety (different listeners can pick what they need)
              userId:
                payload?.userId ||
                payload?.uid ||
                payload?.id ||
                targetUserId ||
                null,
              id: payload?.id || targetUserId || null,

              // Optional metadata
              source: payload?.source || "stack",
              action: payload?.action || "rewind",
              message: payload?.message || null,

              // Full raw payload for advanced consumers
              data: payload,
            };

            console.log(
              "[RewindButton] Dispatching 'rewind:done' event with detail:",
              detail
            );

            window.dispatchEvent(
              new CustomEvent("rewind:done", {
                detail,
              })
            );
          } catch (eventError) {
            // If CustomEvent or window is not available, we fail silently here.
            console.warn(
              "[RewindButton] Failed to dispatch 'rewind:done' event:",
              eventError
            );
          }

          // Refresh user (entitlements / counters) without forcing a full page refresh
          if (typeof refreshUser === "function") {
            try {
              await refreshUser();
            } catch (refreshError) {
              console.warn(
                "[RewindButton] refreshUser failed (non-fatal):",
                refreshError
              );
            }
          }

          return;
        }

        // Non-false ok flag but unexpected payload -> soft error
        const errMsg =
          payload?.message || payload?.error || "Failed to rewind.";
        setMsg(errMsg);

        if (typeof onError === "function") {
          try {
            onError(payload);
          } catch (callbackError) {
            console.error(
              "[RewindButton] onError callback threw an error:",
              callbackError
            );
          }
        }
      } catch (err) {
        const status = err?.response?.status;

        if (status === 400) {
          // Typical: nothing to rewind right now
          setMsg(
            compact
              ? "Nothing to rewind."
              : "Nothing to rewind right now. Try liking or passing a profile first."
          );
        } else if (status === 404) {
          setMsg("Rewind endpoint not available.");
        } else {
          const errMsg =
            err?.response?.data?.message ||
            err?.message ||
            "Network error while rewinding.";
          setMsg(errMsg);
        }

        console.error("[RewindButton] Rewind failed:", err);

        if (typeof onError === "function") {
          try {
            onError(err);
          } catch (callbackError) {
            console.error(
              "[RewindButton] onError callback threw an error:",
              callbackError
            );
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, compact, disabled, onError, onSuccess, refreshUser]
  );

  // --- UI styles (kept readable and consistent) ---
  const baseBtn =
    "inline-flex items-center gap-2 rounded font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2";
  const sizes = compact ? "text-sm px-3 py-1.5" : "text-base px-4 py-2";
  const palette =
    busy || disabled
      ? "bg-gray-300 text-gray-700"
      : "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-400";

  return (
    <div className="flex flex-col items-start gap-1">
      <FeatureGate
        feature="unlimitedRewinds"
        allowPremiumBoolean={true}
        fallback={
          <Link
            to="/settings/subscriptions"
            className={`${baseBtn} ${sizes} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400 ${className}`}
            title="Premium required for rewinds"
          >
            <span aria-hidden>⏪</span>
            <span>{compact ? "Rewind" : "Rewind (Premium)"}</span>
          </Link>
        }
      >
        <button
          type="button"
          aria-label="Rewind"
          onClick={handleRewind}
          disabled={busy || disabled}
          className={`${baseBtn} ${sizes} ${palette} ${className}`}
        >
          <span aria-hidden>⏪</span>
          <span>{compact ? "Rewind" : "Undo Last Action"}</span>
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
// The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed.
// --- REPLACE END ---

