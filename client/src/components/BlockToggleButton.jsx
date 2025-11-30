// PATH: client/src/components/BlockToggleButton.jsx
// --- NEW FILE START: reusable Block / Unblock toggle button ---
import React, { useCallback, useState } from "react";
import api from "../services/api/axiosInstance";

/**
 * BlockToggleButton
 *
 * Reusable button for blocking / unblocking a single user.
 *
 * Props:
 *  - targetUserId: string (required) – the user id to block/unblock
 *  - initialBlocked?: boolean – initial state, if we already know the block status
 *  - className?: string – extra classes for the button
 *  - compact?: boolean – smaller button variant
 *  - onChange?: (isBlocked: boolean) => void – callback when state changes
 */
const BlockToggleButton = ({
  targetUserId,
  initialBlocked = false,
  className = "",
  compact = false,
  onChange,
}) => {
  const [isBlocked, setIsBlocked] = useState(Boolean(initialBlocked));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const handleToggle = useCallback(async () => {
    if (!targetUserId || busy) return;

    setBusy(true);
    setMessage("");

    try {
      let nextBlocked = isBlocked;

      if (isBlocked) {
        // Currently blocked → try to unblock
        const res = await api.delete(`/block/${targetUserId}`);
        // We accept ok=true or absence of error as success
        if (res?.data?.ok === false) {
          throw new Error(res.data.error || "Failed to unblock user.");
        }
        nextBlocked = false;
        setMessage("User unblocked.");
      } else {
        // Currently not blocked → try to block
        const res = await api.post(`/block/${targetUserId}`);
        if (res?.data?.ok === false) {
          throw new Error(res.data.error || "Failed to block user.");
        }
        nextBlocked = true;
        setMessage("User blocked.");
      }

      setIsBlocked(nextBlocked);

      if (typeof onChange === "function") {
        try {
          onChange(nextBlocked);
        } catch (callbackError) {
          // eslint-disable-next-line no-console
          console.error(
            "[BlockToggleButton] onChange callback error:",
            callbackError
          );
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[BlockToggleButton] toggle failed:", err);

      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Network error while updating block state.";

      setMessage(errMsg);
    } finally {
      setBusy(false);
    }
  }, [busy, isBlocked, onChange, targetUserId]);

  const baseBtn =
    "inline-flex items-center gap-2 rounded font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2";
  const sizes = compact ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2";

  const palette = isBlocked
    ? // Unblock (success-ish style)
      busy
      ? "bg-gray-300 text-gray-700"
      : "bg-green-600 hover:bg-green-700 text-white focus:ring-green-400"
    : // Block (danger-ish style)
      busy
      ? "bg-gray-300 text-gray-700"
      : "bg-red-600 hover:bg-red-700 text-white focus:ring-red-400";

  const label = isBlocked ? "Unblock user" : "Block user";

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy || !targetUserId}
        onClick={handleToggle}
        className={`${baseBtn} ${sizes} ${palette} ${className}`}
        aria-pressed={isBlocked}
        aria-label={label}
      >
        <span aria-hidden>{isBlocked ? "🚫" : "⛔"}</span>
        <span>{label}</span>
      </button>

      {message && (
        <p className="text-xs text-gray-700" role="status">
          {message}
        </p>
      )}
    </div>
  );
};

export default BlockToggleButton;
// --- NEW FILE END ---
