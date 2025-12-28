import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

const PremiumCancel = () => {
  const { t } = useTranslation();

  // --- REPLACE START: set document.title from i18n ---
  useEffect(() => {
    document.title = t("premium.cancelTitle");
  }, [t]);
  // --- REPLACE END ---

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold text-red-500 mb-4">
        {/* --- REPLACE START: i18n title --- */}
        ❌ {t("premium.cancelTitle")}
        {/* --- REPLACE END --- */}
      </h1>
      {/* --- REPLACE END --- */}

      {/* --- REPLACE START: i18n defaultValue + keep text English --- */}
      <p className="mb-6">
        {t("premium.cancelMessage", {
          defaultValue: "Checkout was cancelled. Your subscription status did not change.",
        })}
      </p>
      {/* --- REPLACE END --- */}

      {/* --- REPLACE START: ensure correct route path + i18n defaultValue --- */}
      <Link
        className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold border"
        to="/settings/subscriptions"
      >
        {t("premium.goToSubscriptions", {
          defaultValue: "Go to subscription settings",
        })}
      </Link>
      {/* --- REPLACE END --- */}
    </div>
  );
};

export default PremiumCancel;

