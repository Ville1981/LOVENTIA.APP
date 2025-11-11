// PATH: client/src/components/HeaderAdSlot.jsx

/**
 * HeaderAdSlot: global promo/banner just under the navbar.
 * Neutral class/id names on purpose to avoid adblockers.
 */

import React from "react";
// --- REPLACE START: add centralized no-ads gate (Premium kill-switch) ---
import AdGate from "./AdGate"; // wraps ad content; hides on Premium / noAds feature
// --- REPLACE END ---

export default function HeaderAdSlot({ className = "" }) {
  // --- REPLACE START: adjust fill behavior and height (cover + 180px) ---
  /**
   * Notes (all text in English):
   * - Keep the wrapper at full width so the banner spans the viewport.
   * - Fixed height keeps the header compact and consistent.
   * - object-fit: "cover" fills the area (slight vertical crop is expected).
   */
  const WRAP_STYLES = {
    width: "100%",
  };

  const IMG_STYLES = {
    display: "block",
    width: "100%",
    height: "180px", // increased from 170px → 180px for better fill
    objectFit: "cover", // was "contain"; now fills the bar without letterboxing
    objectPosition: "center",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
  };
  // --- REPLACE END ---

  return (
    <div
      className={`promo-header-wrap w-full ${className}`}
      role="complementary"
      aria-label="Header advertisement"
      style={WRAP_STYLES} // --- REPLACE START/END applied here ---
    >
      {/* --- REPLACE START: gate the ad content (renders only when ads are allowed) --- */}
      <AdGate type="inline" debug={false}>
        <img
          src="/ads/header.png"
          alt="Sponsored"
          className="promo-header-img w-full block" // no max-width/mx-auto clamps
          // Enforce full-width + fixed-height + cover
          style={IMG_STYLES}
          loading="lazy"
          decoding="async"
        />
      </AdGate>
      {/* --- REPLACE END --- */}
    </div>
  );
}

