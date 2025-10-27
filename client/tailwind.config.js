// File: client/tailwind.config.js

// --- REPLACE START: merge conflict resolved + unified Tailwind config (with safelist for ad heights) ---
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan all relevant sources. Union of both previous configs so JIT sees everything it should.
  content: [
    "./index.html",
    "./public/**/*.html",
    "./src/**/*.{js,jsx,ts,tsx,html,css}",
  ],

  // Keep class-based dark mode from HEAD
  darkMode: "class",

  // Safelist critical utility classes that we rely on at runtime (ads, etc.)
  // This guarantees the classes exist even if JIT misses them due to dynamic strings.
  safelist: [
    "h-20",          // used by AdBanner image wrapper (≈ 5rem)
    "h-full",        // image height 100%
    "object-cover",  // image fit
    "w-full",        // image width 100%
  ],

  theme: {
    // Preserve custom breakpoints from HEAD
    screens: {
      xs: "320px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },

    // Keep palette extension from HEAD (primary/secondary/etc.)
    extend: {
      colors: {
        primary: "#FF4081",
        secondary: "#005FFF",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
        info: "#3b82f6",
      },
    },
  },

  // Keep line-clamp plugin from HEAD; other plugins can be added here if needed.
  plugins: [require("@tailwindcss/line-clamp")],

  // Keep preflight off like in origin/main, since project styles already normalize globally.
  corePlugins: {
    preflight: false,
  },
};
// --- REPLACE END ---
