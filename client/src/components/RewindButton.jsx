// File: client/src/components/RewindButton.jsx
// --- REPLACE START: new RewindButton with premium "unlimitedRewinds" feature gate ---
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import FeatureGate from "./FeatureGate";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api/axiosInstance";

/**
 * RewindButton
 * - Allows the user to undo the last "pass"/"like".
 * - This is a Premium-only feature ("unlimitedRewinds").
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

  const handleRewind = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    setMsg("");
    try {
      // Axios instance already has /api prefix
      const res = await api.post("/rewind");
      if (res?.data?.ok !== false) {
        setMsg(compact ? "Rewound." : "Last action undone.");
        if (typeof onSuccess === "function") onSuccess(res?.data);
        if (typeof refreshUser === "function") await refreshUser();
      } else {
        const errMsg =
          res?.data?.message || res?.data?.error || "Failed to rewind.";
        setMsg(errMsg);
        if (typeof onError === "function") onError(res?.data);
      }
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Network error while rewinding.";
      setMsg(errMsg);
      if (typeof onError === "function") onError(err);
    } finally {
      setBusy(false);
    }
  }, [busy, compact, disabled, onError, onSuccess, refreshUser]);

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
// --- REPLACE END ---
