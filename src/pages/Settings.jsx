// src/pages/Settings.jsx
import React, { useEffect, useState, useMemo } from "react";

// --- REPLACE START: i18n integration ---
import { useTranslation } from "react-i18next";
// --- REPLACE END ---

import { useAuth } from "../contexts/AuthContext";
import api from "../utils/axiosInstance";

export default function Settings() {
  const { logout, user } = useAuth();

  // --- REPLACE START: i18n hook + document.title ---
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t("settings.title");
  }, [t]);
  // --- REPLACE END ---

  // --- REPLACE START: local UI state for hide/unhide ---
  const [durationMinutes, setDurationMinutes] = useState(0); // 0 = indefinitely
  const [resumeOnLogin, setResumeOnLogin] = useState(true);
  const [loadingHide, setLoadingHide] = useState(false);
  const [loadingUnhide, setLoadingUnhide] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  // --- REPLACE END ---

  // --- REPLACE START: duration options (kept verbose for clarity / future edits) ---
  const durationOptions = useMemo(
    () => [
      { label: t("settings.hideIndefinite"), value: 0 },
      { label: "15 min", value: 15 },
      { label: "30 min", value: 30 },
      { label: "1 h", value: 60 },
      { label: "3 h", value: 180 },
      { label: "6 h", value: 360 },
      { label: "12 h", value: 720 },
      { label: "24 h", value: 1440 },
      { label: "3 days", value: 4320 },
      { label: "7 days", value: 10080 },
    ],
    [t]
  );
  // --- REPLACE END ---

  const handleDelete = async () => {
    // --- REPLACE START: use correct endpoint + safe cleanup + i18n errors ---
    if (!window.confirm(t("settings.deleteConfirm"))) return;
    try {
      await api.delete("/users/me");

      try {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");
      } catch {
        /* noop */
      }

      logout();
    } catch (err) {
      console.error(t("settings.deleteErrorConsole"), err);
      alert(t("settings.deleteErrorAlert"));
    }
    // --- REPLACE END ---
  };

  // --- REPLACE START: hide/unhide handlers ---
  const handleHide = async () => {
    setError("");
    setInfo("");
    setLoadingHide(true);
    try {
      // API expects: { durationMinutes?: number, resumeOnLogin?: boolean }
      await api.put("/users/visibility/hide", {
        durationMinutes: Number(durationMinutes) || 0,
        resumeOnLogin: Boolean(resumeOnLogin),
      });
      setInfo(t("settings.hideSuccess"));
    } catch (e) {
      console.error("Hide error:", e);
      setError(t("settings.hideError"));
    } finally {
      setLoadingHide(false);
    }
  };

  const handleUnhide = async () => {
    setError("");
    setInfo("");
    setLoadingUnhide(true);
    try {
      await api.put("/users/visibility/unhide");
      setInfo(t("settings.unhideSuccess"));
    } catch (e) {
      console.error("Unhide error:", e);
      setError(t("settings.unhideError"));
    } finally {
      setLoadingUnhide(false);
    }
  };
  // --- REPLACE END ---

  return (
    <div className="max-w-3xl mx-auto mt-8 space-y-8 px-3">
      {/* --- REPLACE START: i18n page title --- */}
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      {/* --- REPLACE END --- */}

      {/* ===========================================================
          HIDE / UNHIDE SECTION
          =========================================================== */}
      {/* --- REPLACE START: Hide account block (UI only, calls existing API) --- */}
      <section className="border rounded-md p-4">
        <h2 className="text-lg font-semibold mb-2">
          {t("settings.hideTitle")}
        </h2>

        <p className="text-sm text-gray-700 mb-4">
          {t("settings.hideDescription")}
        </p>

        {/* Duration selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            {t("settings.hideDurationLabel")}
          </label>
          <select
            className="w-full border rounded px-2 py-1"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          >
            {durationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-gray-600">
            {t("settings.hideIndefiniteHint")}
          </div>
        </div>

        {/* Resume on next login */}
        <label className="inline-flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={resumeOnLogin}
            onChange={(e) => setResumeOnLogin(e.target.checked)}
          />
          <span className="text-sm">{t("settings.resumeOnLoginLabel")}</span>
        </label>

        {/* Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <button
            onClick={handleHide}
            disabled={loadingHide}
            className={`w-full py-2 rounded border text-white ${
              loadingHide ? "bg-gray-400" : "bg-gray-700 hover:bg-gray-800"
            }`}
          >
            {loadingHide ? t("settings.hidingNow") : t("settings.hideNowButton")}
          </button>

          <button
            onClick={handleUnhide}
            disabled={loadingUnhide}
            className={`w-full py-2 rounded border text-white ${
              loadingUnhide ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loadingUnhide ? t("settings.unhiding") : t("settings.unhideButton")}
          </button>
        </div>

        {/* Info / Error */}
        {(info || error) && (
          <div className="mt-3">
            {info && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                {info}
              </div>
            )}
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Optional: who is logged in (helps QA) */}
        <div className="mt-3 text-xs text-gray-500">
          {t("settings.signedInAs")}: <strong>{user?.email || "-"}</strong>
        </div>
      </section>
      {/* --- REPLACE END --- */}

      {/* ===========================================================
          DANGER ZONE
          =========================================================== */}
      <section className="mt-2 border-t pt-6">
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
