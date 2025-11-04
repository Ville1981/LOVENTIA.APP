// src/pages/Settings.jsx
import React, { useEffect } from "react";

// --- REPLACE START: i18n integration ---
import { useTranslation } from "react-i18next";
// --- REPLACE END ---

import { useAuth } from "../contexts/AuthContext";
import api from "../utils/axiosInstance";
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";


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
      {/* --- REPLACE START: Password & Security (link to forgot) --- */}
      <section className="mt-4">
        <h2 className="text-lg font-semibold">Password &amp; Security</h2>
        <p className="text-sm text-gray-700 mb-2">
          If you have trouble signing in, you can request a password reset link.
        </p>
        <a href="/forgot-password" className="text-blue-600 hover:underline text-sm">
          Forgot your password?
        </a>
      </section>
      {/* --- REPLACE END --- */}

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
      
{/* // --- REPLACE START: standard content ad slot (inline) --- */}
<AdGate type="inline" debug={false}>
  <div className="max-w-3xl mx-auto mt-6">
    <AdBanner
      imageSrc="/ads/ad-right1.png"
      headline="Sponsored"
      body="Upgrade to Premium to remove all ads."
    />
  </div>
</AdGate>
{/* // --- REPLACE END --- */}
</section>
    </div>
  );
}
