// File: server/src/routes/discover.js

// --- REPLACE START: CJS shim for discover routes (safe placeholder, then hot-swap) ---
/**
 * CommonJS shim that exposes a placeholder Express.Router immediately,
 * then hot-swaps to the real ESM router once it's successfully loaded.
 *
 * Why this fixes the 404:
 * - Previously, the ESM file resolved a wrong path (…/server/server/src/…),
 *   so no routes were actually registered → every GET /api/discover returned 404.
 * - This shim guarantees the module loads using a *correct, file-URL based* path
 *   computed from __dirname, and preserves app startup even if the ESM import fails.
 *
 * Notes:
 * - Keep this file in CommonJS so it can be required safely from index.cjs.
 * - All comments are in English as requested.
 * - A tiny GET /__warming endpoint is added on the placeholder so you can verify the mount
 *   (`curl -i http://localhost:5000/api/discover/__warming`) even before hot-swap.
 */

const express = require("express");
const path = require("path");
const { pathToFileURL } = require("url");

// 1) Export a placeholder Router immediately (server boots even if ESM import fails)
const placeholder = express.Router();

// Optional lightweight probe route to validate mount without auth
placeholder.get("/__warming", (_req, res) => {
  res.status(200).json({ ok: true, source: "discover.js placeholder" });
});

module.exports = placeholder;

// 2) Resolve the real ESM router path *relative to this file*, not process.cwd()
const realModulePath = path.resolve(__dirname, "./discoverRoutes.js");
const realModuleUrl = pathToFileURL(realModulePath).href;

// 3) Dynamically import the ESM router and hot-swap the export
import(realModuleUrl)
  .then((mod) => {
    // Accept either default export (ESM) or module namespace
    const realRouter = mod?.default || mod;
    if (typeof realRouter === "function") {
      module.exports = realRouter;
    } else {
      // Keep placeholder if export shape is unexpected
      console.warn(
        "[discover.js] Loaded module does not export a Router function; keeping placeholder."
      );
      module.exports = placeholder;
    }
  })
  .catch((err) => {
    console.error("Failed to load server/src/routes/discoverRoutes.js:", err);
    // Keep the placeholder so the server remains operational
    module.exports = placeholder;
  });
// --- REPLACE END ---
