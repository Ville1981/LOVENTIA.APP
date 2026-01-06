// PATH: client/src/components/MainLayout.jsx

import React, { Suspense, lazy } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Footer from "../components/Footer";
// --- REPLACE START: lazy-load HeroSection so it is not bundled/parsed on non-home routes ---
/**
 * PERF NOTE
 * ---------
 * HeroSection is only used on Home ("/"). By lazy-loading it, we avoid downloading/parsing
 * the HeroSection code on routes that do not render the hero. This is a safe change because:
 * - isHome gate already prevents rendering on other routes
 * - Suspense fallback is null (no visual change), and we still reserve HERO_MIN_HEIGHT for CLS
 *
 * IMPORTANT: This does NOT change the hero image loading behavior by itself.
 * The image-fetch reduction is handled inside HeroSection.jsx.
 */
const HeroSection = lazy(() => import("../components/HeroSection"));
// --- REPLACE END ---
import Navbar from "../components/Navbar";
import FeatureGate from "./FeatureGate";
import RouteInterstitial from "../components/RouteInterstitial";
import "../styles/ads.css";

/**
 * MainLayout
 * – Renders the Navbar at the top
 * – (HeaderAdSlot removed)  <-- global banner under navbar has been removed entirely
 * – Renders routed page via <Outlet />
 * – Renders Footer at the bottom
 *
 * Accessibility:
 * – Provides a “Skip to content” link for keyboard users.
 * – Uses i18n-backed aria-labels for landmarks.
 */
const MainLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isHome = location.pathname === "/";

  // --- REPLACE START: stabilize layout + allow routed pages to use flex/scroll without 100vh hacks ---
  // Reserve predictable space for parts that may change height due to image loading or async content.
  // This reduces cumulative layout shift (CLS), especially on mobile and slower connections.
  const NAVBAR_MIN_HEIGHT = 64; // px (typical navbar height)
  const FOOTER_MIN_HEIGHT = 120; // px (typical footer height)
  const HERO_MIN_HEIGHT = "clamp(260px, 45vh, 520px)"; // responsive hero space reservation

  // IMPORTANT:
  // We make the middle "content" section flex-1 + min-h-0 so pages like Chat/Map can use
  // internal scrolling (overflow-y-auto) without relying on h-screen/100vh, which causes
  // overflow when combined with Navbar + Footer.
  // --- REPLACE END ---

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

      {/* Interstitial portal root (kept empty until RouteInterstitial opens it) */}
      <div id="route-interstitial-root" />

      {/* NAVBAR (wrapped in header landmark) */}
      <header aria-label={headerAriaLabel}>
        {/* reserve navbar height to reduce CLS during hydration/font/image load */}
        <div style={{ minHeight: NAVBAR_MIN_HEIGHT }}>
          <Navbar />
        </div>
        {/* NOTE: HeaderAdSlot has been removed on purpose */}
      </header>

      {/* Route-level interstitial trigger (renders nothing unless opened) – non-premium only */}
      <FeatureGate feature="noAds" invert>
        <RouteInterstitial
          debug
          delayMs={100}
          ariaLabel={t("layout:ads.interstitial", {
            defaultValue: "Advertisement",
          })}
        />
      </FeatureGate>

      {/* HEADER AD REMOVED (Home & Discover) — intentionally omitted to comply with global removal */}

      {/* --- REPLACE START: make routed content section flex-1 + min-h-0 for correct internal scrolling --- */}
      <div className="w-full flex justify-center bg-[#f9f9f9] flex-1 min-h-0">
        <div className="w-full max-w-[1400px] px-2 py-6 flex flex-col min-h-0">
          {/* CENTER CONTENT (main landmark with target id for skip link) */}
          <main
            id="main-content"
            aria-label={mainAriaLabel}
            className="flex-1 min-h-0"
          >
            {/* reserve hero space (Home only) to reduce CLS */}
            {isHome && (
              <div style={{ minHeight: HERO_MIN_HEIGHT }}>
                {/* --- REPLACE START: render lazy hero with Suspense (no visual change, keeps CLS reservation) --- */}
                <Suspense fallback={null}>
                  <HeroSection />
                </Suspense>
                {/* --- REPLACE END --- */}
              </div>
            )}

            {/* Routed page contents */}
            <Outlet />
          </main>
        </div>
      </div>
      {/* --- REPLACE END --- */}

      {/* FOOTER (wrapped in footer landmark) */}
      <footer aria-label={footerAriaLabel}>
        {/* reserve footer height to reduce CLS during hydration/font load */}
        <div style={{ minHeight: FOOTER_MIN_HEIGHT }}>
          <Footer />
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;


