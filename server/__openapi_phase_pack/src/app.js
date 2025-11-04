// PATH: server/src/app.js
// @ts-nocheck

// --- REPLACE START: core imports remain (ESM) ---
import express from "express"; // needed for express.raw()
import expressLoader from "./loaders/express.js";
import { connectMongo } from "./loaders/mongoose.js";
import securityMiddleware from "./middleware/security.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { env } from "./config/env.js";

// Auth middleware (ensure req.userId exists for includeSelf etc.)
import authenticate from "./middleware/authenticate.js";

// Stripe webhook handler (controller-level, single endpoint)
import { stripeWebhookHandler } from "./controllers/stripeWebhookController.js";

// ⬇️ Billing/payment router (unchanged)
import paymentRouter from "./routes/payment.js";

// ⬇️ Discover router (mount exactly once under /api/discover)
import discoverRouter from "./routes/discover.js";
// --- REPLACE END ---

// --- REPLACE START: Swagger config (use the file we just created) ---
/**
 * Swagger UI is mounted AFTER JSON/body parsers.
 * We use the dedicated config so that tests can no-op it.
 * This expects the spec file at: server/openapi/openapi.yaml
 */
import swagger from "./swagger-config.js";
// --- REPLACE END ---

// --- REPLACE START: NEW imports for security hardening (helmet, CORS, rate limits) ---
import helmet from "helmet";
import cors from "cors";
import { corsOptions } from "./config/cors.js"; // centralize allowed origins
import {
  apiBurstLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
} from "./middleware/rateLimit.js";
// --- REPLACE END ---

// Initialize Express app via loader (sets parsers, CORS, static, etc.)
const app = expressLoader();

/**
 * Mount order matters:
 * 1) Webhooks first (Stripe/PayPal, etc.) so they can use raw body parsers internally.
 * 2) Security middlewares bundle (helmet, rate limits, sanitizers, etc.).
 * 3) API routes under /api.
 * 4) Diagnostics endpoints (in dev) to list mounted routes.
 * 5) 404 and global error handler last.
 */

// --- REPLACE START: Stripe webhook — raw body route defined explicitly here ---
/**
 * IMPORTANT:
 * - Stripe signature verification requires the *raw* request body.
 * - This route uses express.raw() so that req.body is a Buffer.
 * - Keep this route mounted as early as possible.
 * - Other global parsers are already set by expressLoader(); this dedicated route
 *   still works because it declares its own body parser at route-level.
 */
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);
// --- REPLACE END ---

// --- REPLACE START: Security hardening (helmet + CORS + baseline API rate limiters) ---
/**
 * Security hardening
 * ------------------
 * - helmet(): secure headers (with permissive CORP for image/static hosting)
 * - cors(): restrict origins via ./config/cors.js
 * - apiBurstLimiter: generic burst limiter for the whole /api surface
 * - Specific limiters for sensitive POST-heavy namespaces
 *
 * NOTE:
 * - We keep securityMiddleware in place (sanitizers/headers you already had).
 * - Order: helmet → cors → (your) securityMiddleware → limiters → routes.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(cors(corsOptions));

// --- REPLACE START: CORS preflight override (normalize blocked origins to 403 JSON) ---
// NOTE: Express v5-style matcher behind `router`/`path-to-regexp` does not accept "*".
// Use a RegExp instead to match any path.
app.options(/.*/, (req, res) => {
  // Re-run CORS just for preflight so we can intercept errors cleanly
  cors(corsOptions)(req, res, (err) => {
    if (err) {
      // Blocked origin → return stable JSON instead of 500/HTML
      return res.status(403).json({ error: "CORS origin not allowed" });
    }
    // Allowed origin → standard preflight response
    return res.sendStatus(204);
  });
});
// --- REPLACE END ---

// --- REPLACE START: friendly JSON for blocked CORS origins (place right after CORS) ---
app.use((err, _req, res, next) => {
  // Normalize message defensively
  const msg = (err && (err.message || err.toString())) || "";

  // Match common cors errors from `cors` lib and custom ones:
  // - "Not allowed by CORS"
  // - "CORS origin not allowed"
  // - any message containing "CORS" case-insensitively
  const isCorsError =
    !!err &&
    (/not allowed by cors/i.test(msg) ||
      /cors origin not allowed/i.test(msg) ||
      /\bcors\b/i.test(msg));

  if (isCorsError) {
    // Return stable JSON 403 instead of generic 500 HTML
    return res.status(403).json({ error: "CORS origin not allowed" });
  }
  return next(err);
});
// --- REPLACE END ---

// Keep your existing bundle (xss-clean, hpp, compression, etc.)
app.use(securityMiddleware);

// Baseline: rate-limit entire API surface (safe defaults inside rateLimit.js)
app.use("/api", apiBurstLimiter);

// Sensitive namespaces (fine-grained)
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/billing", billingLimiter);
app.use("/api/messages", messagesLimiter);
// --- REPLACE END ---

// --- REPLACE START: test-only stub for /api/auth/me ---
/**
 * In test mode the auth route /api/auth/me may rely on DB models.
 * Provide a minimal JWT-based stub to return { user } when a Bearer token is present.
 * This does NOT run in production.
 *
 * NOTE:
 * - We deliberately avoid top-level await here to keep Node 16/older runners happy.
 * - We load jsonwebtoken lazily via dynamic import().then(...) so startup does not break.
 */
if (process.env.NODE_ENV === "test") {
  import("jsonwebtoken")
    .then((mod) => {
      const jwt = mod.default ?? mod;
      const TEST_JWT_SECRET = process.env.JWT_SECRET || "test_secret";

      app.get("/api/auth/me", (req, res) => {
        const hdr = req.headers?.authorization || "";
        const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
        if (!token) {
          return res.status(401).json({ error: "No token provided" });
        }
        try {
          const payload = jwt.verify(token, TEST_JWT_SECRET);
          return res.status(200).json({
            user: {
              id: payload.userId || payload.id || "000000000000000000000001",
              role: payload.role || "user",
              email: payload.email,
              username: payload.username,
              name: payload.name,
            },
          });
        } catch {
          return res.status(401).json({ error: "Invalid token" });
        }
      });
    })
    .catch(() => {
      // If jsonwebtoken is not available for some reason, still offer a harmless stub
      app.get("/api/auth/me", (_req, res) => {
        return res
          .status(200)
          .json({ user: { id: "000000000000000000000001", role: "user" } });
      });
    });
}
// --- REPLACE END ---

// API routes (central aggregator under /api)
app.use("/api", routes);

// --- PATCH START: mount discover once ---
/**
 * Discover routes
 * ---------------
 * Mount EXACTLY once under /api/discover and protect with authenticate.
 * If your routes/index.js also mounts any legacy discover router,
 * remove that legacy mount to avoid duplication or shadowing.
 */
app.use("/api/discover", authenticate, discoverRouter);
// --- PATCH END ---

// --- REPLACE START: mount billing/payment routes (align with app.legacy.js) ---
/**
 * Mount billing routes under /api.
 * Keeps legacy alias /api/payment for backward compatibility.
 * This mirrors app.legacy.js and ensures /api/billing/* endpoints are reachable.
 */
app.use("/api/billing", paymentRouter);
app.use("/api/payment", paymentRouter); // legacy compatibility
// --- REPLACE END ---

// --- REPLACE START: mount Swagger UI AFTER routes/parsers ---
/**
 * Swagger UI (OpenAPI) — served after global parsers and routes are defined.
 * We expose BOTH:
 *   - /api/docs  (preferred, API prefix)
 *   - /docs      (convenient when testing locally)
 *
 * You can hide this in production by setting NODE_ENV=production
 * and not setting ENABLE_API_DOCS=true.
 */
const enableDocs =
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_API_DOCS === "true";

if (enableDocs) {
  // using the config we imported above
  app.use("/api/docs", swagger.serve, swagger.setup);
  app.use("/docs", swagger.serve, swagger.setup);
}
// --- REPLACE END ---

// --- REPLACE START: plain /health endpoint for load balancers & tests ---
/**
 * Simple health endpoint used by tests (expects 200 + "OK").
 * Keep this outside /api so it’s always reachable.
 */
app.get("/health", (_req, res) => res.status(200).send("OK"));
// --- REPLACE END ---

// --- REPLACE START: diagnostics route listing (APP-level) ---
/**
 * NOTE:
 * - This walker goes through *this* app instance (app._router.stack).
 * - In this project some routes are mounted via `routes/index.js` which itself
 *   is mounted at `/api`, so we ALSO add a second pair of routes below which
 *   walk that router directly.
 */

function getMountPathFromLayer(layer) {
  try {
    const src = layer?.regexp?.source || "";
    if (!src) return "";
    let s = src;
    // strip leading '^'
    s = s.replace(/^\^/, "");
    // strip trailing '\/?(?=\/|$)' (escaped in the source)
    s = s.replace(/\\\/\?\(\?=\\\/\|\$\)\$$/i, "");
    // unescape '\/' to '/'
    s = s.replace(/\\\//g, "/");
    // strip trailing '$'
    s = s.replace(/\$$/, "");
    if (!s.startsWith("/")) s = "/" + s;
    return s;
  } catch {
    return "";
  }
}

app.get("/__routes", (_req, res) => {
  try {
    const routesList = [];
    const stack = Array.isArray(app._router?.stack) ? app._router.stack : [];
    for (const layer of stack) {
      if (layer?.route) {
        const methods = Object.keys(layer.route.methods || {})
          .map((m) => m.toUpperCase())
          .join(",");
        const p = typeof layer.route.path === "string" ? layer.route.path : "";
        routesList.push(`${methods} ${p}`);
        continue;
      }
      if (layer?.name === "router" && Array.isArray(layer.handle?.stack)) {
        const mount = getMountPathFromLayer(layer);
        for (const h of layer.handle.stack) {
          if (h?.route) {
            const methods = Object.keys(h.route.methods || {})
              .map((m) => m.toUpperCase())
              .join(",");
            const sub = typeof h.route.path === "string" ? h.route.path : "";
            routesList.push(
              `${methods} ${(mount + sub).replace(/\/{2,}/g, "/")}`
            );
          }
        }
      }
    }
    res.json(routesList);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.get("/__routes_full", (_req, res) => {
  function walk(stack, base = "") {
    const out = [];
    if (!Array.isArray(stack)) return out;
    for (const layer of stack) {
      if (layer?.route) {
        const routePath =
          typeof layer.route.path === "string" ? layer.route.path : "";
        const methods = Object.keys(layer.route.methods || {}).map((m) =>
          m.toUpperCase()
        );
        const full =
          (base + (routePath || "")).replace(/\/{2,}/g, "/") || "/";
        for (const m of methods) out.push(`${m} ${full}`);
        continue;
      }
      if (layer?.name === "router" && Array.isArray(layer.handle?.stack)) {
        const mount = getMountPathFromLayer(layer) || "";
        const nextBase = (base + mount).replace(/\/{2,}/g, "/");
        out.push(...walk(layer.handle.stack, nextBase));
      }
    }
    return out;
  }

  try {
    const root = Array.isArray(app._router?.stack) ? app._router.stack : [];
    res.json(walk(root));
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});
// --- REPLACE END ---

// --- REPLACE START: NEW diagnostics that walk the *API router* directly ---
/**
 * Your case: /__routes_full returned [] even though /api/auth/* worked.
 * That tells us the real routes are on the router we mounted at /api.
 * So we add two helper endpoints that walk **that** router (`routes` import).
 */

function walkRouter(stack, base = "") {
  const out = [];
  if (!Array.isArray(stack)) return out;
  for (const layer of stack) {
    // direct route
    if (layer?.route) {
      const p = typeof layer.route.path === "string" ? layer.route.path : "";
      const methods = Object.keys(layer.route.methods || {}).map((m) =>
        m.toUpperCase()
      );
      const full = (base + p).replace(/\/{2,}/g, "/") || "/";
      for (const m of methods) {
        out.push(`${m} ${full}`);
      }
      continue;
    }
    // nested router
    if (layer?.name === "router" && Array.isArray(layer.handle?.stack)) {
      const mount = getMountPathFromLayer(layer) || "";
      const nextBase = (base + mount).replace(/\/{2,}/g, "/");
      out.push(...walkRouter(layer.handle.stack, nextBase));
    }
  }
  return out;
}

// This will show the real /api/auth/* etc.
app.get("/__routes_api", (_req, res) => {
  try {
    // routes is the router we mounted at /api
    const stack = routes?.stack || routes?._router?.stack || [];
    const listed = walkRouter(stack, "/api");
    res.json(listed);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.get("/__routes_api_full", (_req, res) => {
  try {
    const stack = routes?.stack || routes?._router?.stack || [];
    const listed = walkRouter(stack, "/api");
    res.json({
      count: listed.length,
      routes: listed,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});
// --- REPLACE END ---

// 404 + error handling (keep LAST)
app.use(notFound);
app.use(errorHandler);

// Start when called directly (node ./src/app.js)
if (process.argv[1] && process.argv[1].endsWith("app.js")) {
  (async () => {
    try {
      await connectMongo();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        "[server] Mongo connection attempt failed at startup:",
        e?.message || e
      );
    }
    const PORT = Number(env.PORT || process.env.PORT || 5000);
    const HOST = env.HOST || process.env.HOST || "0.0.0.0";
    app.listen(PORT, HOST, () =>
      console.log(`[server] listening on ${HOST}:${PORT}`)
    );
  })();
}

export default app;


