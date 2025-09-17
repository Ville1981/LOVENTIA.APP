// File: server/routes/user.cjs

// --- REPLACE START: CJS shim for user routes with fixed import path ---
/**
 * Purpose:
 * - Allow index.cjs (CommonJS) to mount `/api/users` while the real router is ESM.
 * - Keep the SAME Router instance that Express mounted at startup.
 * - Once the ESM router loads, attach it via `placeholder.use(realRouter)` so no 404s.
 *
 * Notes:
 * - This file must stay CommonJS (.cjs) because index.cjs uses `require()`.
 * - All comments are in English for maintainability.
 */
const express = require("express");
const path = require("path");
const { pathToFileURL } = require("url");

// Create a placeholder router and export it immediately.
// Express will hold this instance for the lifetime of the app.
const placeholder = express.Router();
module.exports = placeholder;

// Optional: quick health/warming endpoint to verify mount before ESM loads.
placeholder.get("/__warming", (_req, res) => res.status(204).end());

// Resolve absolute path to the ESM userRoutes.js
const candidate = path.resolve(__dirname, "../src/routes/userRoutes.js");

// Dynamically import the ESM router and ATTACH it to the placeholder.
// We DO NOT replace module.exports after Express has already mounted it.
(async () => {
  try {
    const esm = await import(pathToFileURL(candidate).href);
    const realRouter = esm.default || esm.router || esm;

    if (realRouter && typeof realRouter.use === "function") {
      // If the ESM file exported an Express Router, just mount it under the placeholder.
      placeholder.use(realRouter);
      console.log("✅ /api/users routes attached via user.cjs shim");
    } else {
      console.warn("⚠️ user.cjs: ESM module did not export a valid Express router.");
    }
  } catch (err) {
    console.error("⚠️ user.cjs failed to import userRoutes.js:", err.message);
    // Keep placeholder so server runs; routes remain empty until fixed.
  }
})();
// --- REPLACE END ---
