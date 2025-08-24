// --- REPLACE START: full file with hide/unhide UI + i18n + API integration (kept verbose) ---
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";
import { BACKEND_BASE_URL } from "../config"; // kept for compatibility
import api from "../utils/axiosInstance"; // use the shared Axios instance for all requests

export default function SettingsPage() {
  // Keep existing context usage; add optional setters if available
  const { logout, user, setUser, refreshUser, refreshMe } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isDeleting, setIsDeleting] = useState(false);

  // --- REPLACE START: page title ensures i18n key is applied ---
  useEffect(() => {
    document.title = t("settings.title");
  }, [t]);
  // --- REPLACE END ---

  // --- REPLACE START: local UI state for hide/unhide (kept explicit) ---
  const [durationMinutes, setDurationMinutes] = useState(0); // 0 = indefinitely
  const [resumeOnLogin, setResumeOnLogin] = useState(true);
  const [loadingHide, setLoadingHide] = useState(false);
  const [loadingUnhide, setLoadingUnhide] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  // --- REPLACE END ---

  // --- REPLACE START: duration options (verbose for future edits) ---
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

  // --- REPLACE START: helper prefers refreshMe(), with optimistic fallback ---
  const tryRefreshUser = async (nextHidden) => {
    // Optimistic UI so pill flips immediately even if refresh is slow
    if (typeof setUser === "function" && typeof nextHidden === "boolean") {
      try {
        setUser((prev) => (prev ? { ...prev, hidden: nextHidden } : prev));
      } catch {
        /* noop */
      }
    }

    // Prefer refreshMe() as requested; fallback to refreshUser() if needed
    if (typeof refreshMe === "function") {
      try {
        await refreshMe();
        return;
      } catch {
        /* ignore and try fallback */
      }
    }
    if (typeof refreshUser === "function") {
      try {
        await refreshUser();
      } catch {
        /* final noop */
      }
    }
  };
  // --- REPLACE END ---

  // --- REPLACE START: hide/unhide handlers (server: PATCH /api/users/me/hide|unhide) ---
  const handleHide = async () => {
    setError("");
    setInfo("");
    setLoadingHide(true);
    try {
      await api.patch("/api/users/me/hide", {
        durationMinutes: Number(durationMinutes) || 0,
        resumeOnLogin: Boolean(resumeOnLogin),
      });
      await tryRefreshUser(true);
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
      await api.patch("/api/users/me/unhide");
      await tryRefreshUser(false);
      setInfo(t("settings.unhideSuccess"));
    } catch (e) {
      console.error("Unhide error:", e);
      setError(t("settings.unhideError"));
    } finally {
      setLoadingUnhide(false);
    }
  };
  // --- REPLACE END ---

  // Keep your existing delete flow intact (uses api.delete + logout + navigate)
  const handleDelete = async () => {
    if (isDeleting) return;
    if (!window.confirm(t("settings.deleteConfirm"))) return;
    setIsDeleting(true);
    try {
      await api.delete("/api/users/me");
      try {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");
      } catch {
        /* noop */
      }
      if (typeof logout === "function") logout();
      navigate("/login");
    } catch (err) {
      console.error(t("settings.deleteErrorConsole"), err);
      alert(t("settings.deleteErrorAlert"));
    } finally {
      setIsDeleting(false);
    }
  };

  const isHidden = !!user?.hidden;

  return (
    <div className="max-w-3xl mx-auto px-3 py-6 space-y-8">
      <ControlBar title={t("settings.title")}>
        {/* Keep back button setup untouched */}
        <Button onClick={() => navigate(-1)} variant="secondary">
          {t("buttons.back")}
        </Button>
      </ControlBar>

      {/* ===================== VISIBILITY (HIDE / UNHIDE) ===================== */}
      <section className="border rounded-md p-4 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.hideTitle")}</h2>

        {/* Current status pill */}
        <div className="text-sm">
          <span
            className={`inline-block px-2 py-1 rounded ${
              isHidden ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
            }`}
          >
            {isHidden ? t("settings.currentlyHidden") : t("settings.currentlyVisible")}
          </span>
        </div>

        <p className="text-sm text-gray-700">{t("settings.hideDescription")}</p>

        {/* Duration selector */}
        <div>
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
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={resumeOnLogin}
            onChange={(e) => setResumeOnLogin(e.target.checked)}
          />
          <span className="text-sm">{t("settings.resumeOnLoginLabel")}</span>
        </label>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button onClick={handleHide} disabled={loadingHide || loadingUnhide}>
            {loadingHide ? t("settings.hidingNow") : t("settings.hideNowButton")}
          </Button>
          <Button
            onClick={handleUnhide}
            disabled={loadingUnhide || loadingHide}
            variant="success"
          >
            {loadingUnhide ? t("settings.unhiding") : t("settings.unhideButton")}
          </Button>
        </div>

        {/* Info / Error banners */}
        {(info || error) && (
          <div className="space-y-2">
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
      </section>

      {/* ===================== DANGER ZONE ===================== */}
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>

      <div className="border border-red-300 bg-red-50 p-4 rounded-lg space-y-2">
        <h2 className="text-xl font-semibold text-red-700">
          {t("settings.dangerTitle")}
        </h2>
        <p className="text-sm text-red-600">{t("settings.dangerDescription")}</p>
        <Button onClick={handleDelete} disabled={isDeleting} variant="danger">
          {isDeleting ? t("messages.loading") : t("settings.deleteButton")}
        </Button>
      </div>
    </div>
  );
}
// --- REPLACE END ---
