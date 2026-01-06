// PATH: client/src/pages/Etusivu.jsx
// File: client/src/pages/Etusivu.jsx

import React from "react";
import { useTranslation } from "react-i18next";
// --- REPLACE START: imports for inline content ad slot on Home ---
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";
// --- REPLACE END ---

/**
 * Etusivu
 * The home page hero is rendered by MainLayout.jsx (not here), so this component
 * should render the actual homepage CONTENT below the hero area.
 *
 * i18n:
 * - Use leaf keys + defaultValue so raw keys do not leak to UI.
 * - Coerce outputs with String(...) to avoid crashing if a key resolves to a non-string.
 */
const Etusivu = () => {
  const { t } = useTranslation();

  // --- REPLACE START: safe i18n helpers + English defaults (prevents raw keys/object output) ---
  const safeText = (key, defaultValue) => String(t(key, { defaultValue }));
  // --- REPLACE END ---

  return (
    <div className="px-4 py-6">
      {/* NOTE: HeroSection is rendered by MainLayout on "/" to reduce duplication and CLS. */}

      {/* --- REPLACE START: Homepage content with robust i18n fallbacks --- */}
      <h1 className="text-4xl font-bold mb-4">
        {safeText("home.title", "Welcome to Loventia")}
      </h1>

      <p className="text-lg">
        {safeText("home.subtitle", "Find meaningful connections and start chatting today.")}
      </p>
      {/* --- REPLACE END --- */}

      {/* --- REPLACE START: standard inline content ad slot on Home (hidden for Premium/no-ads) --- */}
      <div className="max-w-3xl mx-auto mt-6">
        <AdGate type="inline">
          <AdBanner
            imageSrc="/ads/ad-right1.png"
            headline={safeText("layout:ads.sponsored", "Sponsored")}
            body={safeText(
              "layout:ads.upgradeToRemove",
              "Upgrade to Premium to remove all ads."
            )}
          />
        </AdGate>
      </div>
      {/* --- REPLACE END --- */}
    </div>
  );
};

export default Etusivu;


