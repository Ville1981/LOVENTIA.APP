// PATH: tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  // --- REPLACE START: Fix content paths for workspace layout (client lives under /client) ---
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,jsx,ts,tsx}",
  ],
  // --- REPLACE END ---

  theme: {
    extend: {},
  },

  plugins: [],

  corePlugins: {
    // Keep existing behavior; this does NOT affect responsive variants.
    preflight: false,
  },
};

