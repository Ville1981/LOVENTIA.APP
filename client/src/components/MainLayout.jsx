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
      <Navbar />

      <div className="w-full bg-white pt-0 pb-4 shadow">
        {/* HeaderAd näkyy vain Discover- ja Etusivuilla */}
        {isHome || isDiscover ? (
          <img
            src="/ads/header1.png"
            alt="Header Ad"
            className="ad-header"
          />
        ) : null}
      </div>

      <div className="w-full flex justify-center px-4 py-6">
        <div className="flex w-full max-w-[1440px] gap-4 items-start">
          {/* VASEN MAINOS */}
          <div className="hidden lg:flex flex-col w-[200px]">
            <AdColumn side="left" />
          </div>

          {/* KESKISISÄLTÖ */}
          <main className="flex-1 flex flex-col items-center gap-6">
            {isHome && <HeroSection />}
            <Outlet />
          </main>

          {/* OIKEA MAINOS */}
          <div className="hidden lg:flex flex-col w-[200px]">
            <AdColumn side="right" />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MainLayout;
