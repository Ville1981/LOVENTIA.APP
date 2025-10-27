// File: client/src/pages/SettingsPage.jsx
// --- REPLACE START: full file with Dealbreakers section + Subscription Settings (structure preserved) ---
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";

import api from "../utils/axiosInstance";
// Dealbreakers UI panel (Premium-gated via internal FeatureGate)
import DealbreakersPanel from "../components/DealbreakersPanel";
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";


export default function SettingsPage() {
  const { logout, user, setUser, refreshUser, refreshMe } = useAuth() || {};
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    document.title = t("settings.title");
  }, [t]);

  // Visibility local state
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [resumeOnLogin, setResumeOnLogin] = useState(true);
  const [loadingHide, setLoadingHide] = useState(false);
  const [loadingUnhide, setLoadingUnhide] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

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

  // Keep UI in sync after server responds
  const tryRefreshUser = async (nextHidden) => {
    const refresh = typeof refreshUser === "function" ? refreshUser : refreshMe;
    if (typeof refresh === "function") {
      try {
        await refresh();
        return;
      } catch {
        /* fall through to optimistic update */
      }
    }
    if (typeof setUser === "function") {
      try {
        setUser((prev) => (prev ? { ...prev, hidden: nextHidden } : prev));
      } catch {
        /* noop */
      }
    }
  };

  // Handlers (with explicit diagnostics)
  const handleHide = async () => {
    console.log("[SETTINGS] hide clicked");
    alert("Hide clicked"); // Diagnostic: must show if click reaches handler
    setError("");
    setInfo("");
    setLoadingHide(true);
    try {
      await api.patch("/users/me/hide", {
        hidden: true,
        minutes: Number(durationMinutes) || 0,
        resumeOnLogin: Boolean(resumeOnLogin),
      });
      await tryRefreshUser(true);
      setInfo(t("settings.hideSuccess")); // ✅ ensure success banner appears
    } catch (e) {
      console.error("Hide error:", e);
      setError(t("settings.hideError"));
    } finally {
      setLoadingHide(false);
    }
  };

  const handleUnhide = async () => {
    console.log("[SETTINGS] unhide clicked");
    alert("Unhide clicked"); // Diagnostic: must show if click reaches handler
    setError("");
    setInfo("");
    setLoadingUnhide(true);
    try {
      await api.patch("/users/me/unhide");
      await tryRefreshUser(false);
      setInfo(t("settings.unhideSuccess")); // ✅ ensure success banner appears
    } catch (e) {
      console.error("Unhide error:", e);
      setError(t("settings.unhideError"));
    } finally {
      setLoadingUnhide(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (!window.confirm(t("settings.deleteConfirm"))) return;
    setIsDeleting(true);
    try {
      await api.delete("/users/me");
      try {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");
      } catch {}
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
  const isPremium = !!(user?.isPremium || user?.premium);

  return (
    <div className="max-w-3xl mx-auto px-3 py-6 space-y-8">
      <ControlBar title={t("settings.title")}>
        <Button onClick={() => navigate(-1)} variant="gray">
          {t("buttons.back")}
        </Button>
      </ControlBar>

      {/* ===================== VISIBILITY (HIDE / UNHIDE) ===================== */}
      <section className="border rounded-md p-4 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.hideTitle")}</h2>

        {/* Status pill */}
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

        {/* Duration */}
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

        {/* Resume on login */}
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={resumeOnLogin}
            onChange={(e) => setResumeOnLogin(e.target.checked)}
          />
          <span className="text-sm">{t("settings.resumeOnLoginLabel")}</span>
        </label>

        {/* Action buttons – use native buttons so onClick cannot be swallowed */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            id="hideBtn"
            type="button"
            aria-label="Hide now"
            data-testid="hide-now"
            onMouseDown={() => console.log("[SETTINGS] mousedown hide")}
            onClick={handleHide}
            disabled={loadingHide || loadingUnhide}
            className="relative z-50 inline-flex items-center justify-center rounded-md px-4 py-2 border border-gray-300 bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
          >
            {loadingHide ? t("settings.hidingNow") : t("settings.hideNowButton")}
          </button>

          <button
            id="unhideBtn"
            type="button"
            aria-label="Unhide"
            data-testid="unhide-now"
            onMouseDown={() => console.log("[SETTINGS] mousedown unhide")}
            onClick={handleUnhide}
            disabled={loadingUnhide || loadingHide}
            className="relative z-50 inline-flex items-center justify-center rounded-md px-4 py-2 border border-green-600 bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loadingUnhide ? t("settings.unhiding") : t("settings.unhideButton")}
          </button>
        </div>

        {/* Info / Error banners (render when either has content) */}
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

      {/* ===================== DEALBREAKERS (NEW) ===================== */}
      <section className="border rounded-md p-4 space-y-3">
        <h2 className="text-lg font-semibold">Discover dealbreakers</h2>
        <p className="text-sm text-gray-700">
          Configure hard filters for matches. This is a Premium feature and will apply to Discover.
        </p>
        {/* Uses internal FeatureGate to show CTA for non-premium users */}
        <DealbreakersPanel user={user} />
      </section>

      {/* ===================== SUBSCRIPTION SETTINGS (NEW) ===================== */}
      <section className="border rounded-md p-4 space-y-3">
        <h2 className="text-lg font-semibold">Subscription Settings</h2>
        <p className="text-sm text-gray-700">
          Manage your Premium plan from here. You can start, manage, or cancel from the dedicated page.
        </p>

        <div className="flex items-center gap-3">
          <span
            className={`inline-block text-xs px-2 py-1 rounded ${
              isPremium ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-800"
            }`}
            title="Current plan indicator"
          >
            Current plan: <strong>{isPremium ? "Premium" : "Free"}</strong>
          </span>

          <Button
            onClick={() => {
              console.log("[SETTINGS] Manage Subscription clicked");
              navigate("/settings/subscriptions");
            }}
            variant="yellow"
            title="Open the subscription settings page"
          >
            Manage Subscription
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          The next page uses our secure billing backend (Stripe/PayPal). We never store your card details.
        </p>
      
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

      {/* ===================== DANGER ZONE ===================== */}
      <div className="border-t pt-6">
        <h2 className="text-xl font-semibold text-red-600">
          {t("settings.dangerTitle")}
        </h2>
        <p className="text-sm text-red-600">{t("settings.dangerDescription")}</p>
        <Button onClick={handleDelete} disabled={isDeleting} variant="red">
          {isDeleting ? t("messages.loading") : t("settings.deleteButton")}
        </Button>
      </div>
    </div>
  );
}
// --- REPLACE END ---

  