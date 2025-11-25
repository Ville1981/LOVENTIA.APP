// File: client/src/components/settings/DeleteAccountSection.jsx

import React, { useState } from "react";
import api from "../../utils/axiosInstance.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

/**
 * Small self-service "Delete my account" section for Settings page.
 *
 * - Calls DELETE /api/users/me using the shared axios instance (api)
 * - On success, logs the user out via AuthContext.logout()
 * - Shows simple error/success messages
 */
export default function DeleteAccountSection() {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleDelete = async () => {
    if (loading) return;

    const confirmed = window.confirm(
      "This will permanently delete your Loventia account and photos. This action cannot be undone. Continue?"
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      // Uses same axios instance as the rest of the app
      await api.delete("/api/users/me");

      setSuccess(true);

      // Give a tiny moment for the message, then log out.
      // logout() should clear tokens + redirect to login/home.
      setTimeout(() => {
        try {
          logout();
        } catch (e) {
          // If logout throws for some reason, at least reload.
          window.location.href = "/login";
        }
      }, 400);
    } catch (err) {
      console.error("Delete account failed:", err);
      const msg =
        err?.response?.data?.error ||
        "Account deletion failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-8 rounded-xl border border-red-300 bg-red-50 p-4">
      <h2 className="text-lg font-semibold text-red-700">
        Delete account
      </h2>

      <p className="mt-1 text-sm text-red-800">
        This will permanently delete your profile, photos and messages.
        This action cannot be undone.
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-2 text-sm text-green-700">
          Account deleted. Logging you out…
        </p>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="mt-3 inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {loading ? "Deleting…" : "Delete my account"}
      </button>
    </section>
  );
}
