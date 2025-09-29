// PATH: server/routes/auth.cjs

// --- REPLACE START: flat /api auth router with robust ESM interop & safe fallbacks ---
"use strict";

/**
 * Auth Shim Router (CommonJS) → mounted at /api
 * -----------------------------------------------------------------------------
 * Goal
 *  - Expose auth endpoints under a single, flat namespace:
 *      POST   /api/register
 *      POST   /api/login
 *      POST   /api/refresh
 *      POST   /api/logout
 *      GET    /api/me
 *      GET    /api/__auth_ping   (diagnostic)
 *
 * Why this change
 *  - Avoids ambiguous duplicates (/register, /auth/register, /api/auth/register, //login, etc.).
 *  - Plays nicely with index.cjs: `app.use(authShim.base || "/api", authShim.router)`.
 *  - If index.cjs also keeps root aliases (307 redirects), they must point to /api/*.
 *
 * ESM controller interop
 *  - We lazy-import the ESM controller once, then cache handlers.
 *  - If import fails or handlers are missing, we DO NOT crash the app:
 *      - We return HTTP 501 (Not Implemented) for the affected endpoints.
 *      - This makes route existence obvious (no more 404), while surfacing the real issue (bad import).
 *
 * Notes
 *  - Keep comments in English for maintainability.
 *  - Do not add duplicate mounts; keep this router focused and predictable.
 */

const path = require("path");
const express = require("express");

const router = express.Router();

// Local JSON parser to protect against global body-parser order changes.
router.use(express.json());

// Resolve the ESM controller path relative to this file.
// Adjust this if your project structure differs.
const controllerPath = path.resolve(
  __dirname,
  "../src/api/controllers/authController.js"
);

// -----------------------------------------------------------------------------
// Lazy ESM import with safe caching and 501 fallbacks
// -----------------------------------------------------------------------------
let _loaded = false;
let _handlers = null;
let _loadError = null;

async function loadControllerOnce() {
  if (_loaded) return;
  _loaded = true;
  try {
    const m = await import(controllerPath);

    // Support both named exports and default-exported object
    const candidate = {
      register:     m.register     || (m.default && m.default.register),
      login:        m.login        || (m.default && m.default.login),
      refreshToken: m.refreshToken || (m.default && m.default.refreshToken),
      logout:       m.logout       || (m.default && m.default.logout),
      me:           m.me           || (m.default && m.default.me),
    };

    // Validate presence of required handlers
    const missing = Object.entries(candidate)
      .filter(([, fn]) => typeof fn !== "function")
      .map(([k]) => k);

    if (missing.length) {
      _loadError = new Error(
        `[auth shim] Missing handlers in ESM controller: ${missing.join(", ")}`
      );
      _handlers = null;
    } else {
      _handlers = candidate;
    }
  } catch (err) {
    _loadError = err;
    _handlers = null;
  }
}

/**
 * Wrap a handler name into a middleware that:
 *  - ensures controller import is attempted once
 *  - calls the real handler if available
 *  - otherwise responds 501 with useful diagnostics (no 404s)
 */
function proxy(fnName) {
  return async (req, res, next) => {
    try {
      await loadControllerOnce();

      const fn = _handlers && _handlers[fnName];
      if (typeof fn === "function") {
        return fn(req, res, next);
      }

      // Not implemented fallback (visibility over silent 404)
      return res.status(501).json({
        error: `Not Implemented: ${fnName}`,
        reason: _loadError ? String(_loadError.message || _loadError) : "Handler missing",
        hint: "Check the ESM controller export(s) and controllerPath in routes/auth.cjs.",
      });
    } catch (err) {
      // If something unexpected happens, surface it as 500
      return next(err);
    }
  };
}

// -----------------------------------------------------------------------------
// Diagnostic endpoint: confirms that this router is alive at /api/__auth_ping
// -----------------------------------------------------------------------------
router.get("/__auth_ping", (_req, res) => res.type("text/plain").send("auth ok"));

// -----------------------------------------------------------------------------
// Flat /api/* endpoints (mounted by index.cjs at base=/api)
// -----------------------------------------------------------------------------
router.post("/register", proxy("register"));
router.post("/login",    proxy("login"));
router.post("/refresh",  proxy("refreshToken"));
router.post("/logout",   proxy("logout"));
router.get ("/me",       proxy("me"));

// -----------------------------------------------------------------------------
// Export shape expected by index.cjs
//  - base: where index.cjs will mount this router
//  - router: the express.Router instance
// -----------------------------------------------------------------------------
module.exports = { base: "/api", router };
// --- REPLACE END ---
