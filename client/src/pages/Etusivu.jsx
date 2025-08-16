import React from "react";
import { useTranslation } from "react-i18next";

/**
 * Etusivu
 * The home page is rendered by MainLayout.jsx, so this component
 * must render the actual homepage content.
 * All visible texts are translated via i18n.
 */
const Etusivu = () => {
  const { t } = useTranslation();

  return (
    <div className="px-4 py-6">
      {/* --- REPLACE START: Add homepage content with i18n --- */}
      <h1 className="text-4xl font-bold mb-4">{t("home.title")}</h1>
      <p className="text-lg">{t("home.subtitle")}</p>
      {/* --- REPLACE END --- */}
    </div>
  );
};

export default Etusivu;
