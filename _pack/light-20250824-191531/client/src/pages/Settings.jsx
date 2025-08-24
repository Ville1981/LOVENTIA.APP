// src/pages/Settings.jsx
import React, { useEffect } from "react";

// --- REPLACE START: i18n integration ---
import { useTranslation } from "react-i18next";
// --- REPLACE END ---

import { useAuth } from "../contexts/AuthContext";
import api from "../utils/axiosInstance";

export default function Settings() {
  const { logout } = useAuth();

  // --- REPLACE START: i18n hook + document.title ---
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t("settings.title");
  }, [t]);
  // --- REPLACE END ---

  const handleDelete = async () => {
    // --- REPLACE START: use correct endpoint + safe cleanup + i18n errors ---
    if (!window.confirm(t("settings.deleteConfirm"))) return;
    try {
      // Hit the correct backend endpoint for self-deletion
      await api.delete("/users/me");

      // Best-effort: clear any locally stored tokens/flags (does not hurt if absent)
      try {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");
      } catch {
        /* noop */
      }

      // Logout will clear auth state and redirect according to your app logic
      logout();
    } catch (err) {
      console.error(t("settings.deleteErrorConsole"), err);
      alert(t("settings.deleteErrorAlert"));
    }
    // --- REPLACE END ---
  };

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      {/* --- REPLACE START: i18n page title --- */}
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      {/* --- REPLACE END --- */}

      {/* Here you could render profile settings, password change forms, etc. */}

      <section className="mt-8 border-t pt-6">
        {/* --- REPLACE START: i18n danger zone --- */}
        <h2 className="text-xl font-semibold text-red-600">
          {t("settings.dangerTitle")}
        </h2>
        <p className="text-sm text-gray-700 mb-4">
          {t("settings.dangerDescription")}
        </p>
        <button
          onClick={handleDelete}
          className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
        >
          {t("settings.deleteButton")}
        </button>
        {/* --- REPLACE END --- */}
      </section>
    </div>
  );
}
