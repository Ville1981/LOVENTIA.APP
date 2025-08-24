// File: client/src/components/HiddenStatusBanner.jsx

// --- REPLACE START: actual hidden-status banner with unhide action ---
import React, { useMemo, useState } from "react";
import api from "../utils/axiosInstance";

/**
 * HiddenStatusBanner
 * - Shows a visible banner when the current user is hidden.
 * - Allows quick "Unhide now" action.
 * - Keeps UI local (does not require global auth refetch), but exposes onUnhidden() callback.
 *
 * Props:
 *  - user: the authenticated user object (may contain hidden/isHidden/visibility.*)
 *  - onUnhidden?: callback invoked after successful unhide to refresh lists
 */
function HiddenStatusBanner({ user, onUnhidden }) {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Decide if the user is currently hidden and compute optional time left text
  const { isHidden, timeLeftText } = useMemo(() => {
    const hidden =
      user?.hidden === true ||
      user?.isHidden === true ||
      user?.visibility?.isHidden === true ||
      (user?.visibility?.hiddenUntil &&
        new Date(user.visibility.hiddenUntil) > new Date());

    let text = "";
    const until = user?.hiddenUntil || user?.visibility?.hiddenUntil || null;

    if (hidden && until) {
      const ms = new Date(until).getTime() - Date.now();
      if (ms > 0) {
        const mins = Math.ceil(ms / 60000);
        const hours = Math.floor(mins / 60);
        const rem = mins % 60;
        text = hours > 0 ? `${hours}h ${rem}m remaining` : `${mins}m remaining`;
      }
    }
    return { isHidden: !!hidden, timeLeftText: text };
  }, [user]);

  if (!isHidden || dismissed) return null;

  const handleUnhide = async () => {
    try {
      setBusy(true);
      await api.patch("/users/me/unhide");
      setDismissed(true);
      if (typeof onUnhidden === "function") onUnhidden();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to unhide:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 shadow p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm sm:text-base">
            <strong>Your profile is currently hidden.</strong>{" "}
            {timeLeftText ? <span>({timeLeftText})</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUnhide}
              disabled={busy}
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-60"
            >
              {busy ? "Unhiding…" : "Unhide now"}
            </button>
            <a
              href="/settings"
              className="text-sm underline decoration-amber-700 hover:text-amber-800"
            >
              Visibility settings
            </a>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-sm text-amber-900/70 hover:text-amber-900"
              title="Dismiss"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HiddenStatusBanner;
// --- REPLACE END ---
