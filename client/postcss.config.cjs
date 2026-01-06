// PATH: client/postcss.config.cjs

/**
 * PostCSS config (Tailwind v4)
 *
 * IMPORTANT:
 * - Tailwind v4 does NOT export "tailwindcss/nesting".
 * - If you have `require("tailwindcss/nesting")`, Vite will crash with:
 *   ERR_PACKAGE_PATH_NOT_EXPORTED
 *
 * This config:
 * - Uses @tailwindcss/postcss + autoprefixer (works with your installed versions)
 * - Enables CSS nesting ONLY if "postcss-nesting" is installed (optional; safe fallback)
 */

// --- REPLACE START: Tailwind v4 compatible PostCSS plugin chain (no tailwindcss/nesting) ---
let postcssNesting = null;
try {
  postcssNesting = require("postcss-nesting");
} catch {
  postcssNesting = null;
}

module.exports = {
  plugins: [
    ...(postcssNesting ? [postcssNesting] : []),
    require("@tailwindcss/postcss"),
    require("autoprefixer"),
  ],
};
// --- REPLACE END ---
