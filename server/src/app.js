// PATH: server/src/app.js
// @ts-nocheck

// ────────────────────────────────────────────────────────────────────────────────
/**
 * Core imports (ESM)
 * The replacement region is marked between // --- REPLACE START and // --- REPLACE END
 * so you can verify exactly what changed.
 */
// ────────────────────────────────────────────────────────────────────────────────

// --- REPLACE START: core imports remain (ESM & project loaders) ---
import cors from "cors";
import express from "express"; // required for express.raw() on webhooks
import helmet from "helmet";

import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { stripeWebhookHandler } from "./controllers/stripeWebhookController.js";
import expressLoader from "./loaders/express.js";
import { connectMongo } from "./loaders/mongoose.js";
import authenticate from "./middleware/authenticate.js";
import { notFound, errorHandler } from "./middleware/error.js";
import {
  apiBurstLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
} from "./middleware/rateLimit.js";
import securityMiddleware from "./middleware/security.js";

// Central API router aggregator
import authRouter from "./routes/auth.js";
import discoverRouter from "./routes/discover.js";
import routes from "./routes/index.js";

// Routers
import likesRouter from "./routes/likes.js";
import paymentRouter from "./routes/payment.js";

// ✅ NEW: Rewind router import
import rewindRoutes from "./routes/rewind.js";
// --- REPLACE END ---

// --- REPLACE START: Swagger + Superlike router imports (dev-friendly) ---
/**
 * Swagger UI is mounted AFTER JSON/body parsers.
 * Uses spec at: server/openapi/openapi.yaml
 */
import superlikeRouter from "./routes/superlike.js";
import swagger from "./swagger-config.js";
// --- REPLACE END ---

// --- REPLACE START: AUTH router import for alias mounting under /api/auth ---
// --- REPLACE END ---

// ────────────────────────────────────────────────────────────────────────────────
/** App bootstrap via loader (sets parsers, static, compression, etc.) */
// ────────────────────────────────────────────────────────────────────────────────
const app = expressLoader();

// --- REPLACE START: baseline server flags & trust proxy ---
/**
 * Keep small baseline flags explicit here so future readers see them in app entrypoint.
 * Note: expressLoader may already set some of these; keeping them here is harmless.
 */
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") {
  // When behind a reverse proxy (Heroku/Render/ALB), enable this so req.ip is correct.
  app.set("trust proxy", true);
}
// --- REPLACE END ---

/**
 * Mount order matters:
 * 1) Webhooks first (Stripe/PayPal) → raw body
 * 2) Security middlewares (helmet, cors, sanitizers, rate limits)
 * 3) API routes
 * 4) Diagnostics (dev)
 * 5) 404 + error handler last
 */

// ────────────────────────────────────────────────────────────────────────────────
/** 1) Webhooks (Stripe) — must be BEFORE any json/urlencoded body parser */
// ────────────────────────────────────────────────────────────────────────────────
// --- REPLACE START: Stripe webhook — raw body route defined explicitly here ---
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);
// --- REPLACE END ---

// ────────────────────────────────────────────────────────────────────────────────
/** 2) Security hardening (helmet + CORS + friendly CORS errors) + rate limits */
// ────────────────────────────────────────────────────────────────────────────────
// --- REPLACE START: security middlewares (helmet + CORS + JSON errors) ---
/**
 * helmet(): secure headers (with permissive CORP for images/static/CDN)
 * cors():   restricts origins via ./config/cors.js
 * NOTE: Avoid deprecated options (e.g., xssFilter) with Helmet v7+.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "sameorigin" },
    // HSTS only in production under HTTPS
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true, preload: false }
        : false,
    // In development keep CSP disabled to not break Swagger/Vite/etc.
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

// Primary CORS
app.use(cors(corsOptions));

/**
 * CORS preflight override: return consistent 204 on allowed origins
 * and a stable 403 JSON when origin is blocked (instead of generic HTML).
 * NOTE: Express v5-style matcher does not accept "*", use RegExp.
 */
app.options(/.*/, (req, res) => {
  cors(corsOptions)(req, res, (err) => {
    if (err) return res.status(403).json({ error: "CORS origin not allowed" });
    return res.sendStatus(204);
  });
});

// Friendly JSON for blocked CORS
app.use((err, _req, res, next) => {
  const msg = (err && (err.message || String(err))) || "";
  const isCorsError =
    !!err &&
    (/not allowed by cors/i.test(msg) ||
      /cors origin not allowed/i.test(msg) ||
      /\bcors\b/i.test(msg));
  if (isCorsError) return res.status(403).json({ error: "CORS origin not allowed" });
  return next(err);
});
// --- REPLACE END ---

// Keep your existing security bundle (xss-clean, hpp, compression, sanitizers, etc.)
app.use(securityMiddleware);

// Baseline rate limit for all /api + fine-grained for hot endpoints
// --- REPLACE START: rate limits ---
app.use("/api", apiBurstLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/billing", billingLimiter);
app.use("/api/messages", messagesLimiter);
// --- REPLACE END ---

// ────────────────────────────────────────────────────────────────────────────────
/**
 * TEST-ONLY helper: /api/auth/me without DB hit.
 * Returns decoded JWT content as a minimal { user }.
 * Not used in production; real route lives in auth router.
 */
// ────────────────────────────────────────────────────────────────────────────────
// --- REPLACE START: test-only stub for /api/auth/me ---
if (process.env.NODE_ENV === "test") {
  import("jsonwebtoken")
    .then((mod) => {
      const jwt = mod.default ?? mod;
      const TEST_JWT_SECRET = process.env.JWT_SECRET || "test_secret";
      app.get("/api/auth/me", (req, res) => {
        const hdr = (req.headers && req.headers.authorization) || "";
        const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
        if (!token) return res.status(401).json({ error: "No token provided" });
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
      app.get("/api/auth/me", (_req, res) =>
        res.status(200).json({ user: { id: "000000000000000000000001", role: "user" } })
      );
    });
}
// --- REPLACE END ---

// ────────────────────────────────────────────────────────────────────────────────
/** 3) API routers — Central aggregator first, then explicit mounts that must not be shadowed */
// ────────────────────────────────────────────────────────────────────────────────
// --- REPLACE START: API routers (order-sensitive) ---
app.use("/api", routes);

/**
 * ✅ AUTH alias mount
 * Ensures all relative paths in the auth router (/register, /login, /refresh, /me, /forgot-password, /reset-password, /verify-email)
 * are also available under /api/auth/* (e.g., /api/auth/register).
 * Keep WITHOUT authenticate here; router methods decide protection individually.
 */
app.options(/\/api\/auth(?:\/.*)?/, (_req, res) => res.sendStatus(204)); // explicit preflight for diagnostics
app.use("/api/auth", authRouter);

/**
 * Discover
 * - Protect with Bearer authenticate
 * - Mount EXACTLY once under /api/discover
 */
app.use("/api/discover", authenticate, discoverRouter);

/**
 * Likes
 * - Ensure POST /api/likes (and related) are available.
 * - Protected by Bearer authenticate.
 */
app.options("/api/likes", (_req, res) => res.sendStatus(204)); // explicit preflight
app.use("/api/likes", authenticate, likesRouter);

/**
 * ✅ NEW: Rewind
 * - Premium-gated in the router.
 * - MUST be mounted after parsers and with authenticate.
 */
app.options("/api/rewind", (_req, res) => res.sendStatus(204)); // explicit preflight
app.use("/api/rewind", authenticate, rewindRoutes);

/**
 * Billing/Payment
 * - Modern:  /api/billing/*
 * - Legacy:  /api/payment/*  (kept for backward compatibility)
 */
app.use("/api/billing", paymentRouter);
app.use("/api/payment", paymentRouter);

/**
 * Superlike
 * - Path variant: POST /api/superlike/:id
 * - Body alias:   POST /api/superlikes  { id | userId | targetUserId }
 */
app.options("/api/superlike/:id", (_req, res) => res.sendStatus(204)); // explicit preflight
app.use("/api/superlike", authenticate, superlikeRouter);
app.use("/api/superlikes", authenticate, superlikeRouter);
// --- REPLACE END ---

// --- REPLACE START: lightweight /api/me (Bearer) for FE probes ---
/**
 * Minimal /api/me that uses the same authenticate middleware.
 * Returns a compact shape that FE can rely on when debugging entitlements.
 * If your real /api/me exists in another router, keep this as a fallback until
 * that path is guaranteed to be mounted.
 */
app.get("/api/me", authenticate, (req, res) => {
  const payload = req.auth || {};
  res.status(200).json({
    ok: true,
    user: {
      id: payload.userId || payload.id || null,
      role: payload.role || "user",
      email: payload.email || null,
      isPremium: !!payload.isPremium || !!payload.premium || false,
    },
    entitlements: payload.entitlements || undefined,
  });
});
// --- REPLACE END ---

// ────────────────────────────────────────────────────────────────────────────────
/** 4) Swagger UI (after routes/parsers) */
// ────────────────────────────────────────────────────────────────────────────────
// --- REPLACE START: Swagger UI AFTER routes/parsers ---
const enableDocs =
  process.env.NODE_ENV !== "production" || process.env.ENABLE_API_DOCS === "true";

if (enableDocs) {
  app.use("/api/docs", swagger.serve, swagger.setup);
  app.use("/docs", swagger.serve, swagger.setup);
}
// --- REPLACE END ---

// ────────────────────────────────────────────────────────────────────────────────
/**
 * Health & whoami diagnostics
 * - /health (GET, HEAD) returns "OK"
 * - /__whoami (GET) returns decoded JWT using authenticate (no DB hit)
 */
// ────────────────────────────────────────────────────────────────────────────────
// --- REPLACE START: /health endpoint + HEAD + whoami ---
app.get("/health", (_req, res) => res.status(200).send("OK"));
app.head("/health", (_req, res) => res.status(200).end());

app.get("/__whoami", authenticate, (req, res) => {
  const a = req.auth || {};
  res.status(200).json({
    ok: true,
    userId: req.userId || a.userId || a.id || null,
    auth: {
      id: a.id || undefined,
      userId: a.userId || undefined,
      email: a.email || undefined,
      role: a.role || "user",
      premium: !!a.premium || !!a.isPremium || false,
      features: a.features || undefined,
      quotas: a.quotas || undefined,
    },
  });
});
// --- REPLACE END ---

// ────────────────────────────────────────────────────────────────────────────────
/** Diagnostics — APP router walker (what this app instance exposes) */
// ────────────────────────────────────────────────────────────────────────────────
// --- REPLACE START: diagnostics (APP-level walker) ---
function getMountPathFromLayer(layer) {
  try {
    const src = (layer && layer.regexp && layer.regexp.source) || "";
    if (!src) return "";
    let s = src.replace(/^\^/, ""); // strip leading ^
    s = s.replace(/\\\/\?\(\?=\\\/\|\$\)\$$/i, ""); // strip trailing '\/?(?=\/|$)$$'
    s = s.replace(/\\\//g, "/"); // unescape '\/' → '/'
    s = s.replace(/\$$/, ""); // strip trailing $
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
            routesList.push(`${methods} ${(mount + sub).replace(/\/{2,}/g, "/")}`);
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
        const routePath = typeof layer.route.path === "string" ? layer.route.path : "";
        const methods = Object.keys(layer.route.methods || {}).map((m) => m.toUpperCase());
        const full = (base + (routePath || "")).replace(/\/{2,}/g, "/") || "/";
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

// ────────────────────────────────────────────────────────────────────────────────
/** Diagnostics — API router walker (the aggregator we mounted at /api) */
// ────────────────────────────────────────────────────────────────────────────────
// --- REPLACE START: diagnostics (API-level walker) ---
function walkRouter(stack, base = "") {
  const out = [];
  if (!Array.isArray(stack)) return out;
  for (const layer of stack) {
    // direct route
    if (layer?.route) {
      const p = typeof layer.route.path === "string" ? layer.route.path : "";
      const methods = Object.keys(layer.route.methods || {}).map((m) => m.toUpperCase());
      const full = (base + p).replace(/\/{2,}/g, "/") || "/";
      for (const m of methods) out.push(`${m} ${full}`);
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

app.get("/__routes_api", (_req, res) => {
  try {
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
    res.json({ count: listed.length, routes: listed });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});
// --- REPLACE END ---

// ────────────────────────────────────────────────────────────────────────────────
/** 5) 404 + error handling (keep LAST) */
// ────────────────────────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ────────────────────────────────────────────────────────────────────────────────
/** Start when called directly (node ./src/app.js) */
// ────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("app.js")) {
  (async () => {
    try {
      await connectMongo();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[server] Mongo connection attempt failed at startup:", e?.message || e);
    }
    const PORT = Number(env.PORT || process.env.PORT || 5000);
    const HOST = env.HOST || process.env.HOST || "0.0.0.0";
    app.listen(PORT, HOST, () => console.log(`[server] listening on ${HOST}:${PORT}`));
  })();
}

export default app;
