import React from "react";
import { Outlet, useLocation } from "react-router-dom";

import AdColumn from "../components/AdColumn";
import Footer from "../components/Footer";
import HeroSection from "../components/HeroSection";
import Navbar from "../components/Navbar";
import "../styles/ads.css";

/**
 * MainLayout
 * – Renders the Navbar at the top
 * – Shows a header ad on Home & Discover
 * – Lays out 3 columns: left ad, main content, right ad
 * – Renders routed page via <Outlet />
 * – Renders Footer at the bottom
 */
const MainLayout = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isDiscover = location.pathname.startsWith("/discover");

  return (
    <div
      className="min-h-screen flex flex-col bg-[#f9f9f9]"
      style={{ overflowAnchor: "none" }}
    >
      {/* NAVBAR */}
      <Navbar />

      {/* HEADER AD (only on Home & Discover) */}
      {(isHome || isDiscover) && (
        <div className="w-full flex justify-center bg-white py-3 shadow">
          {/* --- REPLACE START: use VITE env var for ad source --- */}
          <img
            src={import.meta.env.VITE_HEADER_AD_SRC || "/ads/header1.png"}
            alt="Main Header Ad"
            className="ad-header"
          />
          {/* --- REPLACE END --- */}
        </div>
      )}

      {/* MAIN 3‑COLUMN LAYOUT */}
      <div className="w-full flex justify-center bg-[#f9f9f9]">
        <div className="w-full max-w-[1400px] grid grid-cols-12 gap-4 px-2 py-6">
          {/* LEFT AD COLUMN (hidden on small screens) */}
          <aside className="hidden lg:flex col-span-2 ad-column left">
            <AdColumn side="left" />
          </aside>

          {/* CENTER CONTENT */}
          <main className="col-span-12 lg:col-span-8">
            {/* Hero only on Home */}
            {isHome && <HeroSection />}
            {/* Routed page contents */}
            <Outlet />
          </main>

          {/* RIGHT AD COLUMN (hidden on small screens) */}
          <aside className="hidden lg:flex col-span-2 ad-column right">
            <AdColumn side="right" />
          </aside>
        </div>
      </div>

      {/* FOOTER */}
      <Footer />
    </div>
  );
};

export default MainLayout;
