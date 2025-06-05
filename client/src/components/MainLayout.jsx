// src/layouts/MainLayout.jsx

import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import HeroSection from "./HeroSection";
import AdColumn from "../components/AdColumn";
import "../styles/ads.css";

const MainLayout = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isDiscover = location.pathname === "/discover";

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9f9]">
      {/* ────────── NAVBAR ────────── */}
      <Navbar />

      {/* ────────── HEADER-MAINOS ────────── */}
      {(isHome || isDiscover) && (
        <div className="w-full flex justify-center bg-white py-3 shadow">
          <img
            src="/ads/header1.png"
            alt="Main Header Ad"
            className="ad-header"
          />
        </div>
      )}

      {/* ────────── 3-SARAKKEINEN PÄÄSISÄLTÖ ────────── */}
      <div className="w-full flex justify-center bg-[#f9f9f9]">
        <div className="w-full max-w-[1400px] grid grid-cols-12 gap-4 px-2 py-6">
          {/* ─── VASEN MAINOSPALKKI (piilotettu pienemmillä näytöillä) ─── */}
          <aside className="hidden lg:flex col-span-2 ad-column left">
            <AdColumn side="left" />
          </aside>

          {/* ─── KESKISISÄLTÖ (lomake, tulokset tai HeroSection) ─── */}
          <main className="col-span-12 lg:col-span-8">
            {isHome && <HeroSection />}
            {/* Outlet renderöi Discover.jsx:n (tai muut alisivut) tänne */}
            <Outlet />
          </main>

          {/* ─── OIKEA MAINOSPALKKI (piilotettu pienemmillä näytöillä) ─── */}
          <aside className="hidden lg:flex col-span-2 ad-column right">
            <AdColumn side="right" />
          </aside>
        </div>
      </div>

      {/* ────────── FOOTER ────────── */}
      <Footer />
    </div>
  );
};

export default MainLayout;
