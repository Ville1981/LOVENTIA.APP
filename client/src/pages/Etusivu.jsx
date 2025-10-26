// File: client/src/pages/Etusivu.jsx

import React from "react";
import { useTranslation } from "react-i18next";
// --- REPLACE START: imports for inline content ad slot on Home ---
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";
// --- REPLACE END ---

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
      {/* (keep existing hero content) */}
      {/* --- REPLACE START: Add homepage content with i18n --- */}
      <h1 className="text-4xl font-bold mb-4">{t("home.title")}</h1>
      <p className="text-lg">{t("home.subtitle")}</p>
      {/* --- REPLACE END --- */}

      {/* --- REPLACE START: standard inline content ad slot on Home --- */}
      <div className="max-w-3xl mx-auto mt-6">
        <AdGate type="inline">
          <AdBanner
            imageSrc="/ads/ad-right1.png"
            headline="Sponsored"
            body="Upgrade to Premium to remove all ads."
          />
        </AdGate>
      </div>
      {/* --- REPLACE END --- */}
    </div>
  );
};

export default Etusivu;
