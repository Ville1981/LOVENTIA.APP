// File: server/routes/discover.cjs

// --- REPLACE START: CJS shim for discover routes with fixed import path ---
/**
 * Purpose:
 * - Allow index.cjs (CommonJS) to mount `/api/discover` even though the real router is ESM.
 * - Keep the same Router instance that Express mounted at startup.
 * - When the ESM router loads, we attach it with `placeholder.use(realRouter)`.
 *   This way, Express doesn’t lose the reference and 404s are avoided.
 *
 * Notes:
 * - This file must remain CommonJS (.cjs extension) because index.cjs uses require().
 * - All comments are in English for maintainability.
 */
const express = require("express");
const path = require("path");
const { pathToFileURL } = require("url");

// Create placeholder router and export immediately.
// Express will hold on to THIS instance for the lifetime of the app.
const placeholder = express.Router();
module.exports = placeholder;

// Optional: warming endpoint so you can check mount before real routes attach.
placeholder.get("/__warming", (_req, res) => res.status(204).end());

// Resolve absolute path to the ESM discoverRoutes.js
const candidate = path.resolve(__dirname, "../src/routes/discoverRoutes.js");

// Dynamically import the ESM router and attach it to the placeholder.
(async () => {
  try {
    const esm = await import(pathToFileURL(candidate).href);
    const realRouter = esm.default || esm.router || esm;

    // Accept either a router instance (function with .stack) or a Router with .use()
    if (typeof realRouter === "function" && Array.isArray(realRouter.stack)) {
      placeholder.use(realRouter);
      console.log("✅ /api/discover realRouter (function) attached via shim");
    } else if (realRouter && typeof realRouter.use === "function") {
      placeholder.use(realRouter);
      console.log("✅ /api/discover realRouter (with .use) attached via shim");
    } else {
      console.warn("⚠️ discover.cjs: ESM module did not export a valid Express router.");
    }
  } catch (err) {
    console.error("⚠️ discover.cjs failed to import discoverRoutes.js:", err.message);
    // Keep placeholder so server runs, but routes remain empty until fixed.
  }
})();
// --- REPLACE END ---
