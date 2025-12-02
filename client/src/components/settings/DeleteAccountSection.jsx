// File: client/src/components/settings/DeleteAccountSection.jsx

import React, { useState } from "react";
import api from "../../utils/axiosInstance.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

/**
 * Small self-service "Delete my account" section for Settings page.
 *
 * - Asks the user to confirm with their current password (re-auth)
 *   by calling POST /api/auth/login with the current email.
 * - If re-auth succeeds, calls DELETE /api/users/me using the shared axios instance (api).
 * - On success, logs the user out via AuthContext.logout().
 * - Shows simple error/success messages.
 */
export default function DeleteAccountSection() {
  // --- REPLACE START: delete account section with re-auth, delete and session reset ---
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleDelete = async () => {
    if (loading) return;

    setError("");
    setSuccess(false);

    if (!user || !user.email) {
      setError(
        "Could not determine your current email. Please log out and log in again before deleting your account."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter your current password to confirm account deletion."
      );
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete your Loventia account and photos. This action cannot be undone. Continue?"
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      // First step: re-authenticate with the current password.
      // This uses the same login endpoint and should fail if the password is incorrect.
      await api.post("/api/auth/login", {
        email: user.email,
        password,
      });

      // Second step: perform the actual self-delete.
      await api.delete("/api/users/me");

      setSuccess(true);
      setPassword("");

      // Give a tiny moment for the message, then log out.
      // logout() should clear tokens + redirect to login/home.
      setTimeout(() => {
        try {
          logout();
        } catch (e) {
          // If logout throws for some reason, at least reload to the login page.
          window.location.href = "/login";
        }
      }, 400);
    } catch (err) {
      console.error("Delete account (re-auth or delete) failed:", err);

      const status = err?.response?.status;
      const url = err?.config?.url || "";

      let msg;

      if (
        url.includes("/api/auth/login") &&
        (status === 400 || status === 401)
      ) {
        msg = "Incorrect password. Please try again.";
      } else if (err?.response?.data?.error) {
        msg = err.response.data.error;
      } else {
        msg = "Account deletion failed. Please try again.";
      }

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

      <p className="mt-2 text-sm text-red-800">
        For your security, please confirm this action with your current password
        before your Loventia account is deleted.
      </p>

      <div className="mt-3">
        <label
          htmlFor="delete-account-password"
          className="block text-sm font-medium text-red-800"
        >
          Current password
        </label>
        <input
          id="delete-account-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your current password"
          className="mt-1 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-900 placeholder-red-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          disabled={loading}
        />
      </div>

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
  // --- REPLACE END: delete account section with re-auth, delete and session reset ---
}


