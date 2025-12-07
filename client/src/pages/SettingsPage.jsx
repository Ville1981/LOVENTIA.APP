// PATH: client/src/pages/SettingsPage.jsx
// --- REPLACE START: full file with Email verification badge, verification banner, Sessions & security, Dealbreakers, Subscription Settings (structure preserved) ---
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
import DeleteAccountSection from "../components/settings/DeleteAccountSection";

export default function SettingsPage() {
  const { user, setUser, refreshUser, refreshMe } = useAuth() || {};
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isDeleting] = useState(false); // kept for potential future use / to avoid breaking shape

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

  // Email verification local state (banner + resend)
  const [emailInfo, setEmailInfo] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingVerify, setSendingVerify] = useState(false);

  // Sessions & security local state (logout-all)
  const [sessionInfo, setSessionInfo] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);

  // Derive visibility from user object with safe fallbacks
  const visibility = user?.visibility || {};
  const isHidden =
    visibility.isHidden ?? user?.isHidden ?? user?.hidden ?? false;

  // Keep local resumeOnLogin in sync with server state when user changes
  useEffect(() => {
    if (visibility && typeof visibility.resumeOnLogin === "boolean") {
      setResumeOnLogin(visibility.resumeOnLogin);
      return;
    }
    if (typeof user?.resumeOnLogin === "boolean") {
      setResumeOnLogin(user.resumeOnLogin);
    }
  }, [user, visibility]);

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
        // fall through to optimistic update
      }
    }
    if (typeof setUser === "function") {
      try {
        setUser((prev) => {
          if (!prev) return prev;
          const nextVisibility = {
            ...(prev.visibility || {}),
            isHidden: !!nextHidden,
          };
          return {
            ...prev,
            hidden: !!nextHidden,
            isHidden: !!nextHidden,
            visibility: nextVisibility,
          };
        });
      } catch {
        // noop
      }
    }
  };

  // Email verification: resend handler
  const handleResendVerification = async () => {
    if (sendingVerify) return;
    setEmailError("");
    setEmailInfo("");
    setSendingVerify(true);

    try {
      const resp = await api.post("/auth/send-verification-email");
      const data = resp?.data || {};

      if (data.user && typeof setUser === "function") {
        try {
          setUser(data.user);
        } catch {
          // ignore setUser errors
        }
      }

      if (data.message) {
        setEmailInfo(data.message);
      } else {
        setEmailInfo(
          t(
            "settings.verificationRequestSent",
            "Verification email request has been sent."
          )
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("send-verification-email error:", err);
      const fallbackMsg = t(
        "settings.verificationRequestFailed",
        "Failed to send verification email."
      );
      const msg =
        err?.response?.data?.error || err?.message || fallbackMsg;
      setEmailError(msg);
    } finally {
      setSendingVerify(false);
    }
  };

  // Handlers for hide / unhide
  const handleHide = async () => {
    if (loadingHide || loadingUnhide) return;
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
      setInfo(t("settings.hideSuccess"));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Hide error:", e);
      setError(t("settings.hideError"));
    } finally {
      setLoadingHide(false);
    }
  };

  const handleUnhide = async () => {
    if (loadingUnhide || loadingHide) return;
    setError("");
    setInfo("");
    setLoadingUnhide(true);
    try {
      await api.patch("/users/me/unhide");
      await tryRefreshUser(false);
      setInfo(t("settings.unhideSuccess"));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Unhide error:", e);
      setError(t("settings.unhideError"));
    } finally {
      setLoadingUnhide(false);
    }
  };

  // Sessions & security: logout-all handler
  const handleLogoutAllSessions = async () => {
    if (sessionLoading) return;
    setSessionInfo("");
    setSessionError("");
    setSessionLoading(true);

    try {
      const resp = await api.post("/auth/logout-all");
      const msgFromServer = resp?.data?.message;

      const fallbackMessage = t(
        "settings.sessionsLogoutSuccess",
        "Logout from all devices requested. This device has been logged out."
      );

      setSessionInfo(msgFromServer || fallbackMessage);

      // We do NOT immediately navigate away here.
      // Navbar "Logout" button still logs out this device explicitly.
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("logout-all error:", err);
      const fallbackError = t(
        "settings.sessionsLogoutError",
        "Failed to log out from all devices."
      );
      const msg =
        err?.response?.data?.error || err?.message || fallbackError;
      setSessionError(msg);
    } finally {
      setSessionLoading(false);
    }
  };

  const isPremium = !!(user?.isPremium || user?.premium);
  const isEmailVerified = user?.emailVerified === true;
  const userEmail = user?.email || "";

  return (
    <div className="max-w-3xl mx-auto px-3 py-6 space-y-8">
      <ControlBar title={t("settings.title")}>
        <Button onClick={() => navigate(-1)} variant="gray">
          {t("buttons.back")}
        </Button>
      </ControlBar>

      {/* ===================== EMAIL VERIFIED BADGE (SUCCESS STATE) ===================== */}
      {isEmailVerified && (
        <section className="border rounded-md p-4 flex flex-col gap-2 bg-green-50 border-green-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-green-800">
              <span
                aria-hidden="true"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white text-xs"
              >
                ✓
              </span>
              {t(
                "settings.emailVerifiedBadge",
                "Your email address is verified"
              )}
            </span>
            {userEmail && (
              <span className="text-xs text-green-900 break-all">
                {userEmail}
              </span>
            )}
          </div>
          <p className="text-xs text-green-900">
            {t(
              "settings.emailVerifiedBadgeDescription",
              "We use your verified email for account recovery, important security alerts, and billing-related notifications."
            )}
          </p>
        </section>
      )}

      {/* ===================== EMAIL VERIFICATION BANNER (FOR UNVERIFIED USERS) ===================== */}
      {!isEmailVerified && (
        <section className="border rounded-md p-4 space-y-3 bg-yellow-50 border-yellow-200">
          <h2 className="text-lg font-semibold text-yellow-800">
            {t(
              "settings:verifyEmailTitle",
              "Verify your email address"
            )}
          </h2>
          <p className="text-sm text-yellow-900">
            {t(
              "settings:verifyEmailDescription",
              "Please verify your email to keep your account secure and to ensure you receive important notifications from Loventia."
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="yellow"
              onClick={handleResendVerification}
              disabled={sendingVerify}
              title={t(
                "settings.verifyEmailButtonTitle",
                "Send a new verification email"
              )}
            >
              {sendingVerify
                ? t("settings.verifyEmailSending", "Sending…")
                : t(
                    "settings:resendVerificationButton",
                    "Resend verification email"
                  )}
            </Button>
            {userEmail && (
              <span className="text-xs text-gray-700 break-all">
                {userEmail}
              </span>
            )}
          </div>

          {(emailInfo || emailError) && (
            <div className="space-y-2">
              {emailInfo && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  {emailInfo}
                </div>
              )}
              {emailError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {emailError}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ===================== SESSIONS & SECURITY ===================== */}
      <section className="border rounded-md p-4 space-y-4">
        <h2 className="text-lg font-semibold">
          {t("settings.sessionsTitle", "Sessions and security")}
        </h2>
        <p className="text-sm text-gray-700">
          {t(
            "settings.sessionsDescription",
            "If you suspect someone else may have access to your account, you can log out from all devices. This will invalidate refresh tokens and require sign-in again everywhere."
          )}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleLogoutAllSessions}
            disabled={sessionLoading}
            className="inline-flex items-center justify-center rounded-full px-6 py-2 border border-gray-300 bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
          >
            {sessionLoading
              ? t(
                  "settings.sessionsLoggingOut",
                  "Logging out…"
                )
              : t(
                  "settings.sessionsLogoutAllButton",
                  "Log out from all devices"
                )}
          </button>
          <span className="text-xs text-gray-500">
            {t(
              "settings.sessionsLogoutHint",
              "Your current session may also be logged out shortly after this action."
            )}
          </span>
        </div>

        {(sessionInfo || sessionError) && (
          <div className="space-y-2">
            {sessionInfo && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                {sessionInfo}
              </div>
            )}
            {sessionError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {sessionError}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===================== VISIBILITY (HIDE / UNHIDE) ===================== */}
      <section className="border rounded-md p-4 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.hideTitle")}</h2>

        {/* Status pill */}
        <div className="text-sm">
          <span
            className={`inline-block px-2 py-1 rounded ${
              isHidden
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {isHidden
              ? t("settings.currentlyHidden")
              : t("settings.currentlyVisible")}
          </span>
        </div>

        <p className="text-sm text-gray-700">
          {t("settings.hideDescription")}
        </p>

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
          <span className="text-sm">
            {t("settings.resumeOnLoginLabel")}
          </span>
        </label>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            id="hideBtn"
            type="button"
            aria-label="Hide now"
            data-testid="hide-now"
            onClick={handleHide}
            disabled={loadingHide || loadingUnhide}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 border border-gray-300 bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
          >
            {loadingHide
              ? t("settings.hidingNow")
              : t("settings.hideNowButton")}
          </button>

          <button
            id="unhideBtn"
            type="button"
            aria-label="Unhide"
            data-testid="unhide-now"
            onClick={handleUnhide}
            disabled={loadingUnhide || loadingHide}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 border border-green-600 bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loadingUnhide
              ? t("settings.unhiding")
              : t("settings.unhideButton")}
          </button>
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

      {/* ===================== DEALBREAKERS (NEW) ===================== */}
      <section className="border rounded-md p-4 space-y-3">
        <h2 className="text-lg font-semibold">
          {t("settings.dealbreakersTitle", "Discover dealbreakers")}
        </h2>
        <p className="text-sm text-gray-700">
          {t(
            "settings.dealbreakersDescription",
            "Configure hard filters for matches. This is a Premium feature and will apply to Discover."
          )}
        </p>
        {/* Uses internal FeatureGate to show CTA for non-premium users */}
        <DealbreakersPanel user={user} />
      </section>

      {/* ===================== SUBSCRIPTION SETTINGS (NEW) ===================== */}
      <section className="border rounded-md p-4 space-y-3">
        <h2 className="text-lg font-semibold">
          {t("settings.subscriptionTitle", "Subscription Settings")}
        </h2>
        <p className="text-sm text-gray-700">
          {t(
            "settings.subscriptionDescription",
            "Manage your Premium plan from here. You can start, manage, or cancel from the dedicated page."
          )}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-block text-xs px-2 py-1 rounded ${
              isPremium
                ? "bg-indigo-100 text-indigo-800"
                : "bg-gray-100 text-gray-800"
            }`}
            title={t(
              "settings.currentPlanTitle",
              "Current plan indicator"
            )}
          >
            {t("settings.currentPlanLabel", "Current plan:")}{" "}
            <strong>
              {isPremium
                ? t("settings.currentPlanPremium", "Premium")
                : t("settings.currentPlanFree", "Free")}
            </strong>
          </span>

          <Button
            onClick={() => {
              navigate("/settings/subscriptions");
            }}
            variant="yellow"
            title={t(
              "settings.manageSubscriptionTitle",
              "Open the subscription settings page"
            )}
          >
            {t(
              "settings.manageSubscriptionButton",
              "Manage Subscription"
            )}
          </Button>

          {/* Small helper button to open the Premium Hub with all benefits */}
          <Button
            onClick={() => {
              navigate("/premium");
            }}
            variant="gray"
            title={t(
              "settings.viewPremiumBenefitsTitle",
              "View all Premium benefits"
            )}
          >
            {t(
              "settings.viewPremiumBenefitsButton",
              "View Premium benefits"
            )}
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          {t(
            "settings.subscriptionSecurityNote",
            "The next page uses our secure billing backend (Stripe). We never store your card details."
          )}
        </p>

        {/* Inline ad slot (hidden for Premium users via AdGate) */}
        <AdGate type="inline" debug={false}>
          <div className="max-w-3xl mx-auto mt-6">
            <AdBanner
              imageSrc="/ads/ad-right1.png"
              headline={t("ads.sponsoredHeadline", "Sponsored")}
              body={t(
                "ads.removeAdsBody",
                "Upgrade to Premium to remove all ads."
              )}
            />
          </div>
        </AdGate>
      </section>

      {/* ===================== DANGER ZONE ===================== */}
      <section className="border-t pt-6 mt-4 space-y-3">
        <h2 className="text-xl font-semibold text-red-600">
          {t("settings.dangerTitle")}
        </h2>
        <p className="text-sm text-red-600">
          {t("settings.dangerDescription")}
        </p>

        {/* Re-usable, password-based self-delete section */}
        <DeleteAccountSection />
      </section>
    </div>
  );
}
// --- REPLACE END ---

