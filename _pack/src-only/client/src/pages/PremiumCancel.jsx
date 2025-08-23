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
      {/* --- REPLACE START: i18n message --- */}
      <p>{t("premium.cancelMessage")}</p>
      {/* --- REPLACE END --- */}
    </div>
  );
};

export default PremiumCancel;
