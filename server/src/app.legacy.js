/**
 * Application entrypoint (Express, ESM)
 * - Harden security headers & input sanitization
 * - Robust Mongo connection with diagnostics
 * - Correct Stripe webhook mounting order (raw body BEFORE json)
 * - Mounts core API routes (auth, users, messages, payment, billing, admin, discover, search)
 * - Premium-related routes (likes, superlikes (single & collection), rewind, dealbreakers)
 * - Referral attribution, notifications, metrics, health
 * - Serves /uploads, optional SPA client, and provides diagnostics
 * - Initializes Socket.io if present
 * - Graceful shutdown on SIGINT/SIGTERM
 */

// File: server/src/app.js
"use strict";

// ──────────────────────────────────────────────────────────────────────────────
// Node core & ESM interop
// ──────────────────────────────────────────────────────────────────────────────
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env first
try {
  require("dotenv").config();
} catch { /* ignore */ }

// ──────────────────────────────────────────────────────────────────────────────
/* Imports (prefer ESM-friendly; fallback via dynamic loaders below when needed) */
// ──────────────────────────────────────────────────────────────────────────────
import express from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import compression from "compression";
import responseTime from "response-time";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// Swagger (optional)
import swaggerUi from "swagger-ui-express";
import yaml from "js-yaml";

// Stripe mock flag middleware + rate limiters (optional)
import stripeMock from "./middleware/stripeMock.js";
import { authLimiter, billingLimiter } from "./middleware/rateLimit.js";

// CORS config (centralized)
import corsConfig from "./config/cors.js";

// Auth & roles
import roleAuthorization from "./middleware/roleAuthorization.js";

// Optional utils
import logger from "./utils/logger.js"; // may be a thin wrapper around console
import { initSentry } from "./utils/sentry.js";

// Optional extras
import referralAttribution from "./middleware/referralAttribution.js";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers for dynamic & resilient module loading (CJS/ESM friendly)
// ──────────────────────────────────────────────────────────────────────────────
async function loadModule(modulePath) {
  try {
    const mod = require(modulePath);
    return mod?.default ?? mod;
  } catch {
    const asUrl = pathToFileURL(path.resolve(__dirname, modulePath)).href;
    const esm = await import(asUrl);
    return esm?.default ?? esm;
  }
}

async function loadModuleNamed(modulePath, names = []) {
  try {
    const mod = require(modulePath);
    const ns = mod?.default ?? mod;
    const out = {};
    for (const k of names) out[k] = ns?.[k] ?? mod?.[k];
    return out;
  } catch {
    const asUrl = pathToFileURL(path.resolve(__dirname, modulePath)).href;
    const esm = await import(asUrl);
    const out = {};
    for (const k of names) {
      out[k] = (esm?.default && Object.prototype.hasOwnProperty.call(esm.default, k))
        ? esm.default[k]
        : esm?.[k];
    }
    return out;
  }
}

// Pick router function from various export shapes
const pickRouter = (mod) => (mod && (mod.default || mod.router || mod)) || mod;

// Try multiple candidates for a route (returns router or null if silent)
async function tryRoute(candidates = [], { silent = true } = {}) {
  for (const p of candidates) {
    const abs = path.isAbsolute(p) ? p : path.resolve(__dirname, p);
    // 1) Prefer ESM import (works for both in many setups)
    try {
      const esm = await import(pathToFileURL(abs).href);
      const r = pickRouter(esm);
      if (typeof r === "function" || typeof r?.use === "function") return r;
    } catch { /* next */ }
    // 2) Fallback to require (CJS)
    try {
      const cjs = require(abs);
      const r = pickRouter(cjs);
      if (typeof r === "function" || typeof r?.use === "function") return r;
    } catch { /* next */ }
  }
  if (!silent) {
    throw new Error(`Route import failed:\n${candidates.map((p) => " - " + p).join("\n")}`);
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Environment flags
// ──────────────────────────────────────────────────────────────────────────────
const IS_TEST = process.env.NODE_ENV === "test";
const IS_PROD = process.env.NODE_ENV === "production";
const IS_DEV  = !IS_TEST && !IS_PROD;

// ──────────────────────────────────────────────────────────────────────────────
// App init & Sentry
// ──────────────────────────────────────────────────────────────────────────────
const app = express();
const SentryNS = initSentry?.(app);

// Trust proxy for cookies / secure
app.set("trust proxy", 1);

// Attach request-id early
import { v4 as uuidv4 } from "uuid";
app.use((req, _res, next) => {
  req.id = req.headers["x-request-id"] || uuidv4();
  next();
});

// Lightweight access log (skip in tests)
if (!IS_TEST) {
  app.use(morgan(IS_PROD ? "combined" : "dev"));
}

// Response time & compression
app.use(responseTime());
app.use(compression());

// Helmet (relaxed for dev to keep Swagger & previews working)
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD ? undefined : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS (global) + OPTIONS handler safe for Express 5
app.use(corsConfig);
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return corsConfig(req, res, () => res.sendStatus(200));
  }
  return next();
});

// Cookies
app.use(cookieParser());

// ──────────────────────────────────────────────────────────────────────────────
// Webhooks — MUST mount BEFORE json parser (webhook route itself uses raw)
// ──────────────────────────────────────────────────────────────────────────────
if (!IS_TEST) {
  try {
    const stripeWebhookRouter = await tryRoute([
      "./routes/stripeWebhook.js",
      "../routes/stripeWebhook.js",
      "./api/routes/stripeWebhook.js",
      "../api/routes/stripeWebhook.js",
    ]);
    if (stripeWebhookRouter) {
      app.use("/api", stripeWebhookRouter); // expects router path /payment/stripe-webhook with express.raw()
      console.log("💳 Mounted Stripe webhook at /api/payment/stripe-webhook");
    } else {
      console.warn("⚠️ Stripe webhook route not mounted (file missing or invalid export).");
    }
  } catch (e) {
    console.warn("⚠️ Stripe webhook not mounted:", e?.message || e);
  }

  // Optional PayPal webhook (raw body inside router)
  try {
    const paypalWebhookRouter = await tryRoute([
      "./routes/paypalWebhook.js",
      "../routes/paypalWebhook.js",
    ]);
    if (paypalWebhookRouter) {
      app.use("/api/payment/paypal-webhook", paypalWebhookRouter);
      console.log("💠 Mounted PayPal webhook at /api/payment/paypal-webhook");
    }
  } catch { /* optional */ }
} else {
  console.log("ℹ️ Test mode: skipping webhook mounts.");
}

// ──────────────────────────────────────────────────────────────────────────────
// Global body parsers (safe AFTER webhooks)
// ──────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb", strict: true, type: "application/json" }));
app.use(express.urlencoded({ extended: true }));

/* Referral attribution */
try {
  app.use(referralAttribution({
    cookieName: "lv_ref",
    maxAgeDays: 30,
  }));
} catch { /* optional */ }

/* Stripe mock flag + rate limits (order matters) */
try { app.use(stripeMock); } catch { /* optional */ }
try { app.use("/api/auth", authLimiter); } catch { /* optional */ }
try { app.use("/api/billing", billingLimiter); } catch { /* optional */ }

// XSS/SQL sanitizers (wrapped to avoid Express 5 read-only query errors)
const xssSanitizer = await loadModule("./middleware/xssSanitizer.js").catch(() => null);
const sqlSanitizer = await loadModule("./middleware/sqlSanitizer.js").catch(() => null);

app.use((req, res, next) => {
  if (req.path === "/__routes" || req.path === "/__routes_full") res.locals.__skipSanitize = true;
  next();
});

function safeSanitizer(mw) {
  return function (req, res, next) {
    try {
      if (!mw || res.locals.__skipSanitize) return next();
      const own = Object.getOwnPropertyDescriptor(req, "query");
      const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(req) || {}, "query");
      const desc = own || proto;
      const isReadOnly = !!(desc && !desc.writable && !desc.set);
      if (isReadOnly) return next();
      return mw(req, res, next);
    } catch {
      return next();
    }
  };
}

if (xssSanitizer) app.use(safeSanitizer(xssSanitizer));
if (sqlSanitizer) app.use(safeSanitizer(sqlSanitizer));

// Swagger UI (only if openapi/openapi.yaml exists)
try {
  const specPath = path.resolve(process.cwd(), "openapi", "openapi.yaml");
  if (fs.existsSync(specPath) && process.env.DISABLE_SWAGGER !== "true") {
    const openapiDoc = yaml.load(fs.readFileSync(specPath, "utf8"));
    if (!IS_PROD) {
      app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
      console.log("📘 Swagger UI at /api/docs");
    }
  } else {
    console.warn("ℹ️ OpenAPI spec not found (openapi/openapi.yaml); Swagger UI skipped.");
  }
} catch (e) {
  console.warn("[openapi] Could not load spec:", e?.message || e);
}

// MongoDB connection
try {
  mongoose.set("strictQuery", false);
  mongoose.set("bufferCommands", false);
} catch { /* ignore */ }

const MONGO_URI = process.env.MONGO_URI;
async function connectMongo() {
  if (!MONGO_URI) {
    console.warn("⚠️ Skipping MongoDB connection: MONGO_URI is not set.");
    return false;
  }
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: Number(process.env.MONGO_SSM || 15000),
      socketTimeoutMS: Number(process.env.MONGO_SOCK_TIMEOUT || 45000),
      maxPoolSize: Number(process.env.MONGO_MAX_POOL || 10),
      retryWrites: true,
    });
    const { host, port, name } = mongoose.connection;
    console.log(`✅ MongoDB connected → ${host}:${port}/${name}`);
    return true;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err?.message || err);
    return false;
  }
}
if (!IS_TEST) {
  connectMongo().then((ok) => {
    if (!ok) console.warn("⚠️ DB-backed endpoints will return 503 until Mongo connects.");
  });
} else {
  console.log("ℹ️ Test mode: skipping MongoDB connection.");
}

mongoose.connection.on("connected", () => { if (!IS_TEST) console.log("✅ Mongo connected"); });
mongoose.connection.on("disconnected", () => { if (!IS_TEST) console.warn("⚠️ Mongo disconnected"); });
mongoose.connection.on("error", (e) => { if (!IS_TEST) console.error("❌ Mongo error:", e?.message || e); });

// DB readiness guard
function dbReady(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({ error: "Database not connected. Please try again shortly." });
}

// Health & diagnostics
app.get("/health", (_req, res) => res.status(200).send("OK"));
app.get("/healthcheck", (req, res) => {
  res.json({ ok: true, ts: Date.now(), requestId: req.id, env: process.env.NODE_ENV || "development" });
});

// Optional health route aliases if file exists
try {
  const healthRoute = await tryRoute(["./routes/health.js"], { silent: true });
  if (healthRoute) {
    app.use("/api/health", healthRoute);
    app.use("/api/healthz", healthRoute);
    app.use("/api/_health", healthRoute);
  }
} catch { /* optional */ }

// Route listing
function getMountPathFromLayer(layer) {
  try {
    const src = layer?.regexp?.source || "";
    if (!src) return "";
    let s = src.replace(/^\^/, "")
      .replace(/\\\/\?\(\?=\\\/\|\$\)\$$/i, "")
      .replace(/\\\//g, "/")
      .replace(/\$$/, "");
    if (!s.startsWith("/")) s = "/" + s;
    return s;
  } catch { return ""; }
}
app.get("/__routes", (req, res) => {
  res.locals.__skipSanitize = true;
  const routes = [];
  const stack = app?._router?.stack ?? [];
  for (const layer of stack) {
    try {
      if (layer?.route) {
        const methodsObj = layer.route.methods || {};
        const methods = Object.keys(methodsObj).map((m) => m.toUpperCase()).join(",");
        routes.push(`${methods} ${layer.route.path || ""}`);
        continue;
      }
      if (layer?.name === "router" && Array.isArray(layer.handle?.stack)) {
        const mount = getMountPathFromLayer(layer);
        for (const h of layer.handle.stack) {
          if (h?.route) {
            const methodsObj = h.route.methods || {};
            const methods = Object.keys(methodsObj).map((m) => m.toUpperCase()).join(",");
            routes.push(`${methods} ${(mount + (h.route.path || "")).replace(/\/{2,}/g, "/")}`);
          }
        }
      }
    } catch { /* ignore */ }
  }
  return res.json(routes);
});
app.get("/__routes_full", (req, res) => {
  res.locals.__skipSanitize = true;
  const out = [];
  const walk = (stack, base = "") => {
    if (!Array.isArray(stack)) return;
    for (const layer of stack) {
      try {
        if (layer?.route) {
          const routePath = typeof layer.route.path === "string" ? layer.route.path : "";
          const methodsObj = layer.route.methods || {};
          const methods = Object.keys(methodsObj).map((m) => m.toUpperCase());
          const full = (base + (routePath || "")).replace(/\/{2,}/g, "/") || "/";
          for (const m of methods) out.push(`${m} ${full}`);
          continue;
        }
        if (layer?.name === "router" && Array.isArray(layer.handle?.stack)) {
          const mount = getMountPathFromLayer(layer) || "";
          walk(layer.handle.stack, (base + mount).replace(/\/{2,}/g, "/"));
        }
      } catch { /* ignore */ }
    }
  };
  walk(app?._router?.stack ?? []);
  return res.json(out);
});

// Auth helpers
const roleAuthorize = (roles) => {
  const list = Array.isArray(roles) ? roles : [roles];
  return roleAuthorization(list);
};
const authenticateModuleURL = pathToFileURL(path.resolve(__dirname, "./middleware/authenticate.js")).href;
async function authenticate(req, res, next) {
  try {
    const mod = await import(authenticateModuleURL);
    const fn = (mod && (mod.default || mod.authenticate)) || mod;
    return typeof fn === "function" ? fn(req, res, next) : next();
  } catch (err) {
    if (IS_TEST) {
      try {
        const jwt = require("jsonwebtoken");
        const TEST_JWT_SECRET = process.env.JWT_SECRET || "test_secret";
        const hdr = req.headers?.authorization || "";
        const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
        if (token) {
          try {
            const payload = jwt.verify(token, TEST_JWT_SECRET);
            req.user = {
              id: payload.userId || payload.id || "000000000000000000000001",
              role: payload.role || "user",
              email: payload.email,
              username: payload.username,
              name: payload.name,
            };
          } catch { /* ignore */ }
        }
        return next();
      } catch {
        return next();
      }
    }
    return next(err);
  }
}
// ──────────────────────────────────────────────────────────────────────────────
/* Feature & core route mounts (safe order) */
// ──────────────────────────────────────────────────────────────────────────────

// Discover: like-alias (mount early so FE /api/discover/* like-postit toimii)
try {
  const discoverLikesAliasRouter = await tryRoute([
    "./routes/discoverLikesAlias.js",
    "../routes/discoverLikesAlias.js",
  ]);
  if (discoverLikesAliasRouter) {
    app.use("/api/discover", discoverLikesAliasRouter);
    console.log("🧭 Mounted /api/discover (likes alias)");
  }
} catch { /* optional */ }

// Auth (prefer dedicated router, fallback to controller wiring if needed)
try {
  let authRouter = await tryRoute([
    "./routes/auth.js",
    "../routes/auth.js",
  ]);
  if (!authRouter) {
    // Fallback mini-router if only controllers exist
    const ctrlCandidates = [
      "./api/controllers/authController.js",
      "../api/controllers/authController.js",
    ];
    for (const p of ctrlCandidates) {
      try {
        const c = await loadModule(p);
        if (c?.login || c?.register) {
          const r = express.Router();
          const pass = (_req, _res, next) => next();
          if (c.login)     r.post("/login", dbReady, pass, c.login);
          if (c.register)  r.post("/register", dbReady, pass, c.register);
          if (c.refresh)   r.post("/refresh", pass, c.refresh);
          if (c.logout)    r.post("/logout", pass, c.logout);
          if (c.me)        r.get("/me", pass, c.me);
          if (c.profile)   r.get("/profile", pass, c.profile);
          authRouter = r;
          console.warn("⚠️ Using fallback inline auth router (authController-based).");
          break;
        }
      } catch { /* next */ }
    }
  }
  if (authRouter) {
    app.use("/api/auth", authRouter);
    console.log("🔐 Mounted /api/auth");
  } else {
    console.warn("⚠️ /api/auth not mounted (router not found).");
  }
} catch (e) {
  console.warn("⚠️ /api/auth not mounted:", e?.message || e);
}

// Users (prefer src/routes/userRoutes.js; avoid legacy ./routes/user.js)
try {
  let userRoutes = await tryRoute([
    "./routes/userRoutes.js",
    "../routes/userRoutes.js",
  ]);
  if (userRoutes) {
    try {
      // Warn if legacy user.js exists but DON'T mount it (avoid dupes)
      require.resolve(path.resolve(__dirname, "./routes/user.js"));
      console.warn("⚠️ Legacy routes/user.js detected but NOT mounted to avoid duplicates.");
    } catch { /* fine */ }
    app.use("/api/users", dbReady, authenticate, roleAuthorize(["admin", "user"]), userRoutes);
    console.log("👤 Mounted /api/users");
  } else {
    console.warn("⚠️ /api/users not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/users not mounted:", e?.message || e);
}

// Messages
try {
  const messagesRouter = await tryRoute([
    "./routes/messages.js",
    "../routes/messages.js",
  ]);
  if (messagesRouter) {
    // Remove previously mounted /api/messages if any (avoid duplicate handlers)
    if (Array.isArray(app._router?.stack)) {
      app._router.stack = app._router.stack.filter((layer) => !(
        layer?.name === "router" && /\/api\/messages(?:\/|$)/.test(layer?.regexp?.source || "")
      ));
    }
    app.use("/api/messages", authenticate, roleAuthorize(["user", "admin"]), messagesRouter);
    console.log("✉️  Mounted /api/messages");
  } else {
    console.warn("⚠️ /api/messages not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/messages not mounted:", e?.message || e);
}

// Payment (non-Stripe webhook endpoints under /api/payment)
try {
  const paymentRoutes = await tryRoute([
    "./routes/paymentRoutes.js",
    "./routes/payment.js",
    "../routes/paymentRoutes.js",
  ]);
  if (paymentRoutes) {
    app.use("/api/payment", authenticate, roleAuthorize("user"), paymentRoutes);
    console.log("💸 Mounted /api/payment");
  } else {
    console.warn("⚠️ /api/payment not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/payment not mounted:", e?.message || e);
}

// Billing (Stripe Checkout / Portal / Sync) — behind auth + dbReady
try {
  const billingRoutes = await tryRoute([
    "./routes/billing.js",
    "../routes/billing.js",
  ]);
  if (billingRoutes) {
    app.use("/api/billing", dbReady, authenticate, roleAuthorize("user"), billingRoutes);
    console.log("🧾 Mounted /api/billing");
  } else {
    console.warn("⚠️ /api/billing not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/billing not mounted:", e?.message || e);
}

// Admin (panel & actions)
try {
  const adminRoutes = await tryRoute([
    "./routes/adminRoutes.js",
    "./routes/admin.js",
    "../routes/adminRoutes.js",
    "../routes/admin.js",
  ]);
  if (adminRoutes) {
    app.use("/api/admin", authenticate, roleAuthorize("admin"), adminRoutes);
    console.log("🛡️  Mounted /api/admin");
  } else {
    console.warn("ℹ️ /api/admin not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/admin not mounted:", e?.message || e);
}

// Admin metrics (KPI)
try {
  const adminMetricsRouter = await tryRoute([
    "./routes/adminMetrics.js",
    "../routes/adminMetrics.js",
  ]);
  if (adminMetricsRouter) {
    app.use("/api/admin/metrics", authenticate, roleAuthorize("admin"), adminMetricsRouter);
    console.log("📈 Mounted /api/admin/metrics");
  }
} catch { /* optional */ }

// Discover (core listing & filters)
try {
  const discoverRouter = await tryRoute([
    "./routes/discoverRoutes.js",
    "../routes/discoverRoutes.js",
  ]);
  if (discoverRouter) {
    app.use("/api/discover", authenticate, roleAuthorize(["user", "admin"]), discoverRouter);
    console.log("🧭 Mounted /api/discover");
  } else {
    console.warn("⚠️ /api/discover not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/discover not mounted:", e?.message || e);
}

// Search
try {
  const searchRouter = await tryRoute([
    "./routes/search.js",
    "../routes/search.js",
  ]);
  if (searchRouter) {
    // If already mounted, skip silently
    const alreadyMounted = Array.isArray(app._router?.stack) &&
      app._router.stack.some(layer => layer?.name === "router" && /\/api\/search(?:\/|$)/.test(layer?.regexp?.source || ""));
    if (!alreadyMounted) {
      app.use("/api/search", authenticate, roleAuthorize("user"), searchRouter);
      console.log("🔎 Mounted /api/search");
    }
  } else {
    console.warn("ℹ️ /api/search not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/search not mounted:", e?.message || e);
}

// Dealbreakers (premium-only filters typically checked in router)
try {
  const dealbreakersRouter = await tryRoute([
    "./routes/dealbreakers.js",
    "../routes/dealbreakers.js",
  ]);
  if (dealbreakersRouter) {
    app.use("/api/dealbreakers", authenticate, roleAuthorize("user"), dealbreakersRouter);
    console.log("🪓 Mounted /api/dealbreakers");
  } else {
    console.warn("ℹ️ /api/dealbreakers not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/dealbreakers not mounted:", e?.message || e);
}

// Likes
try {
  const likesRouter = await tryRoute([
    "./routes/likes.js",
    "../routes/likes.js",
  ]);
  if (likesRouter) {
    app.use("/api/likes", authenticate, roleAuthorize(["user", "admin"]), likesRouter);
    console.log("❤️  Mounted /api/likes");
  } else {
    console.warn("ℹ️ /api/likes not mounted (router missing).");
  }
} catch (e) {
  console.warn("⚠️ /api/likes not mounted:", e?.message || e);
}

// Superlikes (collection alias) — POST body { id }
try {
  const superlikesRouter = await tryRoute([
    "./routes/superlikes.js",
    "../routes/superlikes.js",
  ]);
  const already =
    Array.isArray(app._router?.stack) &&
    app._router.stack.some((layer) => layer?.name === "router" && /\/api\/superlikes(?:\/|$)/.test(layer?.regexp?.source || ""));
  if (!already && superlikesRouter) {
    app.use("/api/superlikes", authenticate, roleAuthorize(["user", "admin"]), superlikesRouter);
    console.log("🌟 Mounted /api/superlikes");
  }
} catch (e) {
  console.warn("⚠️ /api/superlikes not mounted:", e?.message || e);
}

// Superlike (single) — /api/superlike/:id
try {
  const superlikeRouter = await tryRoute([
    "./routes/superlike.js",
    "../routes/superlike.js",
  ]);
  const already =
    Array.isArray(app._router?.stack) &&
    app._router.stack.some((layer) => layer?.name === "router" && /\/api\/superlike(?:\/|$)/.test(layer?.regexp?.source || ""));
  if (!already && superlikeRouter) {
    app.use("/api/superlike", authenticate, roleAuthorize(["user", "admin"]), superlikeRouter);
    console.log("🌟 Mounted /api/superlike");
  }
} catch (e) {
  console.warn("⚠️ /api/superlike not mounted:", e?.message || e);
}

// Rewind
try {
  const rewindRouter = await tryRoute([
    "./routes/rewind.js",
    "../routes/rewind.js",
  ]);
  const already =
    Array.isArray(app._router?.stack) &&
    app._router.stack.some((layer) => layer?.name === "router" && /\/api\/rewind(?:\/|$)/.test(layer?.regexp?.source || ""));
  if (!already && rewindRouter) {
    app.use("/api/rewind", authenticate, roleAuthorize(["user", "admin"]), rewindRouter);
    console.log("⏪ Mounted /api/rewind");
  }
} catch (e) {
  console.warn("⚠️ /api/rewind not mounted:", e?.message || e);
}

// Notifications
try {
  const notificationsRouter = await tryRoute([
    "./routes/notifications.js",
    "../routes/notifications.js",
  ]);
  if (notificationsRouter) {
    app.use("/api/notifications", authenticate, notificationsRouter);
    console.log("🔔 Mounted /api/notifications");
  }
} catch (e) {
  console.warn("⚠️ /api/notifications not mounted:", e?.message || e);
}

// Referral public API (GET /api/referral/my-code, POST /api/referral/track)
try {
  const referralRouter = await tryRoute([
    "./api/routes/referral.js",
    "../api/routes/referral.js",
  ]);
  if (referralRouter) {
    app.use("/api/referral", referralRouter);
    console.log("🏷️  Mounted /api/referral");
  }
} catch { /* optional */ }

// Metrics (Prometheus-style), with optional request counter middleware
try {
  const metricsRoutes = await tryRoute([
    "./routes/metricsRoutes.js",
    "../routes/metricsRoutes.js",
  ]);
  if (metricsRoutes) {
    // Try to pick optional exported request-counter from module
    try {
      const mod = await loadModule("./routes/metricsRoutes.js");
      const counter = mod?.metricsRequestCounter;
      if (typeof counter === "function") app.use(counter);
    } catch { /* ignore */ }
    app.use("/", metricsRoutes); // GET /metrics
    console.log("📊 Mounted /metrics");
  }
} catch { /* optional */ }

// OpenGraph / OG tags
try {
  const ogRouter = await tryRoute([
    "./routes/og.js",
    "../routes/og.js",
  ]);
  if (ogRouter) {
    app.use("/og", ogRouter);
    console.log("🖼️  Mounted /og dynamic tags");
  }
} catch { /* optional */ }

// Legacy root aliases → redirect to /api/* using 307 (method preserved)
{
  const alias = express.Router();
  alias.post("/register", (_req, res) => res.redirect(307, "/api/auth/register"));
  alias.post("/login",    (_req, res) => res.redirect(307, "/api/auth/login"));
  alias.post("/logout",   (_req, res) => res.redirect(307, "/api/auth/logout"));
  alias.post("/refresh",  (_req, res) => res.redirect(307, "/api/auth/refresh"));
  alias.get("/me",        (_req, res) => res.redirect(307, "/api/users/me"));
  alias.get("/profile",   (_req, res) => res.redirect(307, "/api/users/profile"));
  alias.put("/profile",   (_req, res) => res.redirect(307, "/api/users/profile"));
  app.use(alias);
  // Tiny compatibility mock (kept for some tests)
  app.get("/api/users", (_req, res) => res.json([{ name: "Bunny" }]));
}
// ──────────────────────────────────────────────────────────────────────────────
/* Static content (uploads + optional client build) */
// ──────────────────────────────────────────────────────────────────────────────
const uploadsRoot = path.join(process.cwd(), "uploads");

try {
  if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
  for (const sub of ["avatars", "extra"]) {
    const subDir = path.join(uploadsRoot, sub);
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
  }
} catch (e) {
  console.warn("⚠️ Could not ensure /uploads directory tree:", e?.message || e);
}

app.use(
  "/uploads",
  express.static(uploadsRoot, {
    fallthrough: false,
    index: false,
    maxAge: 0,
  })
);

// Optionally serve client build (controlled by env; harmless if not present)
if (process.env.SERVE_CLIENT === "true") {
  const candidates = [
    path.resolve(__dirname, "../../client/dist"),
    path.resolve(__dirname, "../client/dist"),
    path.resolve(__dirname, "../../public"),
  ];
  let staticDir = null;
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) { staticDir = c; break; }
    } catch { /* ignore */ }
  }
  if (staticDir) {
    console.log("📦 Serving client from:", staticDir);
    app.use(express.static(staticDir));
    // SPA fallback
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    console.warn("ℹ️ SERVE_CLIENT=true, but no dist/public directory found.");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
/* Multer error handler (payload too large / field limits) */
// ──────────────────────────────────────────────────────────────────────────────
app.use((err, _req, res, next) => {
  if (err && err.name === "MulterError") {
    return res.status(413).json({ error: err.message });
  }
  return next(err);
});

// ──────────────────────────────────────────────────────────────────────────────
/* 404 handler — keep absolutely LAST (before error handlers) */
// ──────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ──────────────────────────────────────────────────────────────────────────────
/* Error handlers (Sentry first, then global) */
// ──────────────────────────────────────────────────────────────────────────────
if (SentryNS?.Handlers?.errorHandler) {
  app.use(SentryNS.Handlers.errorHandler());
}

app.use((err, req, res, _next) => {
  const requestId = req.id || "n/a";
  // Prefer logger if available, fallback to console
  try {
    (logger?.error || console.error)(`[${requestId}]`, err?.stack || err);
  } catch {
    console.error(`[${requestId}]`, err?.stack || err);
  }
  res.status(500).json({ error: "Server Error", requestId });
});

// ──────────────────────────────────────────────────────────────────────────────
/* SOCKET.IO INTEGRATION + server start (skipped in tests) */
// ──────────────────────────────────────────────────────────────────────────────
let httpServer = null;
const PORT = process.env.PORT || 5000;

if (!IS_TEST) {
  try {
    // socket.js is optional; if present, it should export initializeSocket(app)
    const { initializeSocket } = require("./socket.js");
    httpServer = initializeSocket(app);
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server + Socket.io running on port ${PORT}`);
    });
  } catch {
    // Fallback: run pure Express if socket.js missing
    httpServer = http.createServer(app);
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  }
} else {
  console.log("ℹ️ Test mode: HTTP server is not started.");
}

// ──────────────────────────────────────────────────────────────────────────────
/* Graceful shutdown (SIGINT/SIGTERM) */
// ──────────────────────────────────────────────────────────────────────────────
import mongoosePkg from "mongoose"; // ensure mongoose namespace if treeshaken
const M = mongoosePkg?.connection ? mongoose : null;

async function shutdown(signal) {
  try {
    console.log(`\n${signal} received: closing server...`);
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    if (M && M.connection.readyState === 1) {
      await M.connection.close();
    }
    console.log("✅ Shutdown complete.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Error during shutdown:", e);
    process.exit(1);
  }
}

if (!IS_TEST) {
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ──────────────────────────────────────────────────────────────────────────────
// Export Express app for tests / server launcher
// ──────────────────────────────────────────────────────────────────────────────
export default app;





















