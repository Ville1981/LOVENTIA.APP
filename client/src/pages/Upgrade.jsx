// --- REPLACE START: robust Upgrade that waits for auth bootstrap & keeps your flow ---
import React, { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

/**
 * Upgrade
 * - Uses AuthContext and waits for "bootstrapped" before deciding auth state.
 * - If logged out: shows login prompt.
 * - If logged in: shows upgrade content and navigates to /settings/subscriptions.
 * - Keeps your original button destination and plan bullets.
 * - All copy goes through i18n "premium" namespace (with English fallbacks).
 */
const Upgrade = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("premium");

  // Support both shapes:
  // 1) { isLoggedIn, bootstrapped }
  // 2) { user, bootstrapped }
  const auth = useAuth?.() || {};
  const { isLoggedIn, user, bootstrapped } = auth;

  // Resolve final "authenticated" state only after bootstrap
  const authenticated = useMemo(() => {
    if (bootstrapped === false || bootstrapped === undefined) {
      // treat as "unknown"
      return false;
    }
    return typeof isLoggedIn === "boolean" ? isLoggedIn : !!user;
  }, [bootstrapped, isLoggedIn, user]);

  const handleUpgrade = () => {
    // Redirect to subscription/payment flow (kept from your original code)
    navigate("/settings/subscriptions");
  };

  // Avoid flashing the login prompt during the auth bootstrap phase
  if (!bootstrapped) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">
          {t("upgradeCheckingSessionTitle", "Checking your session…")}
        </h1>
        <p className="text-gray-600">
          {t("upgradeCheckingSessionBody", "Please wait a moment.")}
        </p>
      </div>
    );
  }

  // Not authenticated -> login prompt
  if (!authenticated) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">
          {t("upgradeSignInRequiredTitle", "Sign in required")}
        </h1>
        <p className="mb-4">
          {t(
            "upgradeSignInRequiredBody",
            "To view Premium benefits and upgrade your account, please sign in."
          )}
        </p>
        <Link
          to="/login"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {t("upgradeGoToLogin", "Go to Login")}
        </Link>
      </div>
    );
  }

  // Authenticated -> show upgrade content
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">
        {t("upgradeTitle", "Upgrade to Premium")}
      </h1>

      <ul className="list-disc list-inside space-y-2 text-lg">
        <li>
          🔍 {t("benefitSeeWhoLikedYou", "See who liked you")}
        </li>
        <li>
          ⭐ {t("benefitSuperLikes", "3 Super Likes per week")}
        </li>
        <li>
          ❓ {t("benefitQAVisibility", "Unlock all Q&A visibility")}
        </li>
        <li>
          ❤️ {t("benefitUnlimitedLikes", "Unlimited likes")}
        </li>
        <li>
          🚫 {t("benefitDealbreakers", "Dealbreakers feature")}
        </li>
        <li>
          ⏪ {t("benefitUnlimitedRewinds", "Unlimited rewinds")}
        </li>
        <li>
          📩 {t("benefitIntrosMessaging", "Unlock Intros messages")}
        </li>
        <li>
          🚫 {t("benefitNoAds", "No ads")}
        </li>
      </ul>

      <button
        onClick={handleUpgrade}
        className="mt-6 w-full py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition"
      >
        {t("upgradeContinueButton", "Continue to Subscription")}
      </button>

      <p className="text-xs text-gray-500">
        {t(
          "upgradeFooterNote",
          "You’ll be redirected to your subscription settings. Payment is handled by your configured provider (e.g., Stripe)."
        )}
      </p>
    </div>
  );
};

export default Upgrade;
// --- REPLACE END ---

