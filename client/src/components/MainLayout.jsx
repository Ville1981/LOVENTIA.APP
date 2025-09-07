// client/src/components/MainLayout.jsx
// --- REPLACE START: add i18n-backed aria-labels, skip link, and alt texts (no structural changes) ---
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import AdColumn from "../components/AdColumn";
import Footer from "../components/Footer";
import HeroSection from "../components/HeroSection";
import Navbar from "../components/Navbar";
import FeatureGate from "./FeatureGate";
import "../styles/ads.css";

/**
 * MainLayout
 * – Renders the Navbar at the top
 * – Shows a header ad on Home & Discover (hidden if user has noAds entitlement)
 * – Lays out 3 columns: left ad, main content, right ad
 * – Renders routed page via <Outlet />
 * – Renders Footer at the bottom
 *
 * Accessibility:
 * – Provides a “Skip to content” link for keyboard users.
 * – Uses i18n-backed aria-labels for landmarks and ad regions.
 */
const MainLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isDiscover = location.pathname.startsWith("/discover");

  // i18n-backed strings (leaf keys only; provide English defaults)
  const skipToContentText = t("common:a11y.skipToContent", {
    defaultValue: "Skip to main content",
  });
  const headerAriaLabel = t("layout:landmarks.header", {
    defaultValue: "Site header",
  });
  const mainAriaLabel = t("layout:landmarks.main", {
    defaultValue: "Main content",
  });
  const footerAriaLabel = t("layout:landmarks.footer", {
    defaultValue: "Site footer",
  });
  const leftAdsAriaLabel = t("layout:ads.left", {
    defaultValue: "Left advertisements",
  });
  const rightAdsAriaLabel = t("layout:ads.right", {
    defaultValue: "Right advertisements",
  });
  const headerAdAlt = t("layout:ads.headerAlt", {
    defaultValue: "Main header ad",
  });

  return (
    <div
      className="min-h-screen flex flex-col bg-[#f9f9f9]"
      style={{ overflowAnchor: "none" }}
    >
      {/* Skip to content (visible on focus) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-blue-700 focus:ring focus:ring-blue-300 rounded px-3 py-2 shadow"
      >
        {skipToContentText}
      </a>

      {/* NAVBAR (wrapped in header landmark) */}
      <header aria-label={headerAriaLabel}>
        <Navbar />
      </header>

      {/* HEADER AD (only on Home & Discover, gated by noAds) */}
      {(isHome || isDiscover) && (
        <FeatureGate feature="noAds" invert>
          <div className="w-full flex justify-center bg-white py-3 shadow">
            <img
              src={import.meta.env.VITE_HEADER_AD_SRC || "/ads/header1.png"}
              alt={headerAdAlt}
              className="ad-header"
            />
          </div>
        </FeatureGate>
      )}

      {/* MAIN 3-COLUMN LAYOUT */}
      <div className="w-full flex justify-center bg-[#f9f9f9]">
        <div className="w-full max-w-[1400px] grid grid-cols-12 gap-4 px-2 py-6">
          {/* LEFT AD COLUMN (hidden on small screens, gated by noAds) */}
          <aside
            className="hidden lg:flex col-span-2 ad-column left"
            aria-label={leftAdsAriaLabel}
          >
            <FeatureGate feature="noAds" invert>
              <AdColumn side="left" />
            </FeatureGate>
          </aside>

          {/* CENTER CONTENT (main landmark with target id for skip link) */}
          <main id="main-content" className="col-span-12 lg:col-span-8" aria-label={mainAriaLabel}>
            {/* Hero only on Home */}
            {isHome && <HeroSection />}
            {/* Routed page contents */}
            <Outlet />
          </main>

          {/* RIGHT AD COLUMN (hidden on small screens, gated by noAds) */}
          <aside
            className="hidden lg:flex col-span-2 ad-column right"
            aria-label={rightAdsAriaLabel}
          >
            <FeatureGate feature="noAds" invert>
              <AdColumn side="right" />
            </FeatureGate>
          </aside>
        </div>
      </div>

      {/* FOOTER (wrapped in footer landmark) */}
      <footer aria-label={footerAriaLabel}>
        <Footer />
      </footer>
    </div>
  );
};

export default MainLayout;
// --- REPLACE END ---
