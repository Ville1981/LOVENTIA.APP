// PATH: server/index.cjs

// --- REPLACE START: dynamic-import bridge (remove local /api/auth mount; keep diagnostics and other shims intact) ---
"use strict";

/**
 * CommonJS bridge that dynamically imports the ESM Express app.
 * - Keeps "type": "module" setups intact.
 * - Importing this file evaluates ./src/app.js (which should create and export the Express `app`).
 * - Exports a Promise that resolves to the Express `app` instance (default/app/app.default).
 *
 * IMPORTANT:
 *  • Do NOT mount /api/auth here (older builds did this). Auth is provided by the dedicated shim at ./routes/auth.cjs.
 *  • Keep diagnostics: console dump + GET /__routes + GET /__routes_full.
 *  • Optional shims for other feature routers (users, discover) remain supported.
 */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

// Resolve the ESM app and choose the most likely export carrying the Express `app`.
const appPromise = import("./src/app.js").then((m) => m.default || m.app || m);
module.exports = appPromise;

/* --------------------------------- Helpers -------------------------------- */

/** Resolve first existing path from candidates (keeps original behavior). */
function resolveExistingFile(candidates) {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore fs errors
    }
  }
  return null;
}

/** Load a router exported via CJS or ESM. Returns a Router function or null. */
async function loadRouter(filePath) {
  if (!filePath) return null;
  if (filePath.endsWith(".cjs")) {
    const mod = require(filePath);
    return mod?.default || mod?.router || mod || null;
  } else {
    const mod = await import(pathToFileURL(filePath).href);
    return mod?.default || mod?.router || mod || null;
  }
}

/**
 * Extract a human-readable mount prefix from an Express layer's RegExp.
 * This is best-effort but sufficient to show meaningful base paths.
 */
function extractMountFromLayer(layer) {
  try {
    if (layer?.regexp?.fast_slash) return "/";
    if (layer?.regexp?.fast_star) return "*";
    const src = layer?.regexp?.toString() || "";
    // Capture literal segment between slashes (e.g. /^\/api\/auth\/?/ -> "api")
    const m = src.match(/\\\/([^\\^$?()[\]+*{}|]+)\\\//);
    if (m && m[1]) return `/${m[1]}`;
    return "";
  } catch {
    return "";
  }
}

/**
 * Recursively walk an Express stack and collect FULL paths including base mounts.
 * Output format: "METHODS /base/path".
 */
function collectFullPaths(appOrRouter) {
  const out = [];
  const walk = (stack, prefix = "") => {
    if (!Array.isArray(stack)) return;

    for (const layer of stack) {
      // Terminal route layer
      if (layer?.route?.path) {
        const methods = Object.keys(layer.route.methods || {})
          .filter(Boolean)
          .map((m) => m.toUpperCase())
          .join(",");
        out.push(`${methods} ${prefix}${layer.route.path}`);
        continue;
      }
      // Nested router
      if (layer?.name === "router" && layer?.handle?.stack) {
        const mount = extractMountFromLayer(layer);
        walk(layer.handle.stack, `${prefix}${mount}`);
      }
    }
  };
  const stack = appOrRouter?._router?.stack || appOrRouter?.stack;
  if (stack) walk(stack, "");
  return out;
}

/* ------------------------------- Shim Mounts ------------------------------- */

/**
 * After the ESM app is loaded, mount shims if present.
 * NOTE: /api/auth is intentionally NOT mounted here — it now lives flat under /api via ./routes/auth.cjs.
 */
appPromise.then(async (app) => {
  if (!app || typeof app.use !== "function") {
    console.error("❌ App did not resolve to an Express instance from ./src/app.js");
    return;
  }

  // USERS shim
  try {
    const usersPath = resolveExistingFile([
      path.resolve(__dirname, "./routes/user.js"),
      path.resolve(__dirname, "./routes/user.cjs"),
      path.resolve(__dirname, "./src/routes/user.js"),
      path.resolve(__dirname, "./src/routes/user.cjs"),
    ]);
    if (usersPath) {
      const usersRouter = await loadRouter(usersPath);
      if (typeof usersRouter === "function") {
        app.use("/api/users", usersRouter);
        console.log("✅ Mounted /api/users via shim:", usersPath);
      } else {
        console.warn("⚠️ Users shim exported a non-router value. File:", usersPath, "Type:", typeof usersRouter);
      }
    } else {
      console.warn("⚠️ Users shim not found (./routes|./src/routes user.{js,cjs})");
    }
  } catch (e) {
    console.warn("⚠️ Could not mount /api/users:", e?.message || e);
  }

  // --- REPLACE START: ensure auth shim is mounted even if auto-discovery skips it ---
  try {
    const authShim = require("./routes/auth.cjs"); // exports { base: "/api", router }
    if (authShim && authShim.router) {
      app.use(authShim.base || "/api", authShim.router);
      console.log("🔐 Mounted /api auth routes via auth.cjs shim");
    } else {
      console.warn("⚠️ auth.cjs present but router missing.");
    }
  } catch (err) {
    console.warn("⚠️ Could not mount auth.cjs shim:", err && err.message ? err.message : err);
  }

  // 🔧 Direct diagnostic endpoint (bypasses router) to prove /api path is reachable in this mount order.
  // If this returns 404, an earlier /api/* handler is intercepting requests before our shims.
  app.get("/api/__auth_ping_direct", (_req, res) => res.type("text/plain").send("auth ok (direct)"));
  // --- REPLACE END ---

  // DISCOVER shim
  try {
    const discoverPath = resolveExistingFile([
      path.resolve(__dirname, "./routes/discover.js"),
      path.resolve(__dirname, "./routes/discover.cjs"),
      path.resolve(__dirname, "./src/routes/discover.js"),
      path.resolve(__dirname, "./src/routes/discover.cjs"),
    ]);
    if (discoverPath) {
      const discoverRouter = await loadRouter(discoverPath);
      if (typeof discoverRouter === "function") {
        app.use("/api/discover", discoverRouter);
        console.log("✅ Mounted /api/discover via shim:", discoverPath);
      } else {
        console.warn("⚠️ Discover shim exported a non-router value. File:", discoverPath, "Type:", typeof discoverRouter);
      }
    } else {
      console.warn("⚠️ Discover shim not found (./routes|./src/routes discover.{js,cjs})");
    }
  } catch (e) {
    console.warn("⚠️ Could not mount /api/discover:", e?.message || e);
  }

  /* --------------------------- Root alias redirects --------------------------- */
  // The app historically exposed root aliases. Keep them, but redirect to the new flat /api/* endpoints.
  // This eliminates wrong targets like /api/auth/* and removes double-slash artifacts.
  // NOTE: Use 307 to preserve HTTP method for POST.
  // --- REPLACE START: redirect aliases to flat /api/* ---
  try {
    app.post("/register", (req, res) => res.redirect(307, "/api/register"));
    app.post("/login",    (req, res) => res.redirect(307, "/api/login"));
    app.post("/refresh",  (req, res) => res.redirect(307, "/api/refresh"));
    app.post("/logout",   (req, res) => res.redirect(307, "/api/logout"));
    app.get ("/me",       (req, res) => res.redirect(307, "/api/me"));
    // Optional diagnostic alias for convenience:
    app.get("/__auth_ping", (_req, res) => res.redirect(307, "/api/__auth_ping"));
    console.log("🔁 Root aliases → /api/* redirects registered (307).");
  } catch (e) {
    console.warn("⚠️ Could not register root alias redirects:", e?.message || e);
  }
  // --- REPLACE END ---

  /* --------------------------- Diagnostics endpoints --------------------------- */

  // Console dump with full mount prefixes
  try {
    const listed = collectFullPaths(app);
    console.log("🔎 All mounted routes (full paths):", listed);
  } catch (e) {
    console.warn("⚠️ Could not list routes to console:", e?.message || e);
  }

  // Provide GET /__routes with FULL paths (avoid double-register if already present).
  try {
    const already = (collectFullPaths(app) || []).some((r) => r.endsWith(" /__routes"));
    if (!already) {
      app.get("/__routes", (_req, res) => {
        try {
          res.json(collectFullPaths(app));
        } catch (err) {
          res.status(500).json({ error: err?.message || String(err) });
        }
      });
      console.log("🧭 Registered /__routes diagnostics endpoint (full-path walker).");
    }
  } catch (e) {
    console.warn("⚠️ Could not register /__routes diagnostics endpoint:", e?.message || e);
  }

  // Provide an unconditional GET /__routes_full (never skipped), useful if /__routes existed earlier.
  try {
    app.get("/__routes_full", (_req, res) => {
      try {
        res.json(collectFullPaths(app));
      } catch (err) {
        res.status(500).json({ error: err?.message || String(err) });
      }
    });
    console.log("🧭 Registered /__routes_full diagnostics endpoint (full-path walker).");
  } catch (e) {
    console.warn("⚠️ Could not register /__routes_full:", e?.message || e);
  }

  // NOTE: Keep 404 handler inside src/app.js AFTER all mounts. Do not add another here.
});
// --- REPLACE END ---











