// File: server/routes/dealbreakers.cjs

// --- REPLACE START: CJS shim for dealbreakers routes with late attachment ---
/**
 * Purpose:
 * - Let index.cjs/app.js (CommonJS) mount `/api/dealbreakers` while the real router is ESM.
 * - Keep the SAME Router instance that Express mounted at startup.
 * - After the ESM module loads, attach it via `placeholder.use(realRouter)` to avoid 404s.
 *
 * Notes:
 * - This file must stay CommonJS (.cjs) because it is required() from CJS code.
 * - We try both `server/src/routes/dealbreakersRoutes.js` and `server/src/routes/dealbreakers.js`.
 * - All comments are in English for maintainability.
 */
const express = require("express");
const path = require("path");
const { pathToFileURL } = require("url");

// Create a placeholder router and export it immediately.
// Express will keep this instance; we will attach the real routes onto it later.
const placeholder = express.Router();
module.exports = placeholder;

// Optional: tiny warm-up endpoint to verify mount before ESM loads.
placeholder.get("/__warming", (_req, res) => res.status(204).end());

// Candidate ESM files (absolute paths)
const candidates = [
  path.resolve(__dirname, "../src/routes/dealbreakersRoutes.js"),
  path.resolve(__dirname, "../src/routes/dealbreakers.js"),
];

// Import the first working ESM router and ATTACH it to the placeholder.
// We DO NOT mutate module.exports after export to prevent Express from losing the reference.
(async () => {
  for (const file of candidates) {
    try {
      const esm = await import(pathToFileURL(file).href);
      const realRouter = esm.default || esm.router || esm;

      if (realRouter && typeof realRouter.use === "function") {
        placeholder.use(realRouter);
        console.log(`✅ /api/dealbreakers routes attached via dealbreakers.cjs shim (${path.basename(file)})`);
        return;
      } else {
        console.warn(`⚠️ dealbreakers.cjs: ${path.basename(file)} did not export a valid Express router.`);
      }
    } catch (err) {
      // Try the next candidate
      // eslint-disable-next-line no-console
      console.warn(`ℹ️ dealbreakers.cjs: import failed for ${path.basename(file)} → ${err.message}`);
    }
  }
  console.error("⚠️ dealbreakers.cjs: No valid ESM router found (dealbreakersRoutes.js/dealbreakers.js). Keeping placeholder only.");
})();
// --- REPLACE END ---
