// PATH: server/src/routes/index.js
// or:   server/routes/index.js (depending on your tree)
import express from "express";

// --- REPLACE START: Import modules in a robust way and normalize their exports ---
// Central note: do NOT set CORS headers here. All CORS is handled by server/src/config/cors.js.
// Some route files export using `export default router` (ESM),
// others may export as `{ router }` or `module.exports = router` (CJS interop compiled to ESM namespace).
// To avoid "does not provide an export named 'default'" errors, we import as namespace and pick the router.
import * as adminNS from "./admin.js";
import * as adminMetricsNS from "./adminMetrics.js";
import * as adminRoutesNS from "./adminRoutes.js";
import * as authNS from "./auth.js";
import * as authPrivateRoutesNS from "./authPrivateRoutes.js";
import * as authRoutesNS from "./authRoutes.js";
import * as billingNS from "./billing.js";
import * as dealbreakersNS from "./dealbreakers.js";
// ⚠️ Discover mounts are centralized in app.js to avoid duplicates/shadowing.
// import * as discoverLikesAliasNS from "./discoverLikesAlias.js";
// import * as discoverRoutesNS from "./discoverRoutes.js";
import * as healthRoutesNS from "./healthRoutes.js";
import * as imageRoutesNS from "./imageRoutes.js";
import * as introsNS from "./intros.js";
import * as likesNS from "./likes.js";
import * as meNS from "./me.js";
import * as messagesNS from "./messages.js";
import * as metricsRoutesNS from "./metricsRoutes.js";
import * as moderationNS from "./moderation.js";
import * as notificationsNS from "./notifications.js";
import * as qaNS from "./qa.js";
import * as referralNS from "./referral.js";
import * as referralRoutesNS from "./referralRoutes.js";
import * as rewindNS from "./rewind.js";
import * as searchNS from "./search.js";
import * as socialNS from "./social.js";
import * as socialRoutesNS from "./socialRoutes.js";
import * as superlikeNS from "./superlike.js";
import * as superlikesNS from "./superlikes.js";
import * as userRoutesNS from "./userRoutes.js";
import * as usersNS from "./users.js";
import authenticate from "../middleware/authenticate.js";

function pickRouter(ns) {
  // Prefer ESM default, then a named `router`, else the namespace itself if it's a function
  return (ns && (ns.default || ns.router)) || (typeof ns === "function" ? ns : null);
}

const admin = pickRouter(adminNS);
const adminMetrics = pickRouter(adminMetricsNS);
const adminRoutes = pickRouter(adminRoutesNS);
const auth = pickRouter(authNS); // ⬅️ our new full ESM auth router (HAS /me, /login, /register, /refresh, /reset)
const authPrivateRoutes = pickRouter(authPrivateRoutesNS); // ⬅️ safe, only /private/*
const authRoutes = pickRouter(authRoutesNS);
const billing = pickRouter(billingNS);
const dealbreakers = pickRouter(dealbreakersNS);
// const discoverLikesAlias = pickRouter(discoverLikesAliasNS);
// const discoverRoutes = pickRouter(discoverRoutesNS);
const healthRoutes = pickRouter(healthRoutesNS);
const imageRoutes = pickRouter(imageRoutesNS);
const intros = pickRouter(introsNS);
const likes = pickRouter(likesNS);
const me = pickRouter(meNS);
const messages = pickRouter(messagesNS);
const metricsRoutes = pickRouter(metricsRoutesNS);
const moderation = pickRouter(moderationNS);
const notifications = pickRouter(notificationsNS);
const qa = pickRouter(qaNS);
const referral = pickRouter(referralNS);
const referralRoutes = pickRouter(referralRoutesNS);
const rewind = pickRouter(rewindNS);
const search = pickRouter(searchNS);
const social = pickRouter(socialNS);
const socialRoutes = pickRouter(socialRoutesNS);
const superlike = pickRouter(superlikeNS);
const superlikes = pickRouter(superlikesNS);
const userRoutes = pickRouter(userRoutesNS);
const users = pickRouter(usersNS);
// --- REPLACE END ---

const router = express.Router();

// Small helper: mount + console log; skips if router is missing or invalid.
const use = (path, r, name) => {
  if (!r || (typeof r !== "function" && typeof r.use !== "function")) {
    console.warn(`[routes] skipped ${name || path} (no valid router)`);
    return;
  }
  router.use(path, r);
  console.log(`[routes] mounted ${name || path} at ${path}`);
};

// Helper: like `use` but ensures requests pass through `authenticate` first.
// This keeps auth local to sensitive bases without changing global behavior.
const useAuth = (path, r, name) => {
  if (!r || (typeof r !== "function" && typeof r.use !== "function")) {
    console.warn(`[routes] skipped (auth) ${name || path} (no valid router)`);
    return;
  }
  router.use(path, authenticate, r);
  console.log(`[routes] mounted (auth) ${name || path} at ${path}`);
};

/**
 * NOTE on mount bases:
 * app.js uses `app.use('/api', routes)` → mounting at '/' here means they show under /api/*.
 * To restore canonical paths (e.g. /api/auth/login, /api/users/*), we mount routers
 * under their expected base prefixes below. Avoid duplicates and keep order stable.
 *
 * IMPORTANT: Do not set any Access-Control-Allow-* headers here. CORS is handled globally
 * by `server/src/config/cors.js`, which is applied at the app level.
 */

// Health + metrics at root of /api
use("/", healthRoutes, "healthRoutes");
use("/", metricsRoutes, "metricsRoutes");

// Admin (mount base /admin so /api/admin/* resolves correctly)
use("/admin", admin, "admin");
use("/admin", adminRoutes, "adminRoutes");
// Metrics endpoints under /api/admin/metrics (if router itself exposes /metrics)
if (adminMetrics) {
  // If adminMetrics defines `/metrics`, mounting at /admin yields /api/admin/metrics
  use("/admin", adminMetrics, "adminMetrics");
}

// --- REPLACE START: auth mount order — NEW ESM AUTH FIRST, THEN ALWAYS PRIVATE, THEN OPTIONAL LEGACY ---
// 1) New main auth router (the big one with /me, reset, forgot, register, refresh, logout)
if (auth) {
  use("/auth", auth, "auth"); // → /api/auth/*
}

// 2) ALWAYS mount the lightweight private auth router.
if (authPrivateRoutes) {
  use("/auth", authPrivateRoutes, "authPrivateRoutes"); // → /api/auth/private/*
}

// 3) Legacy/public segmented auth routes (old structure) — opt-in only.
const ENABLE_AUTH_LEGACY =
  process.env.ENABLE_AUTH_LEGACY === "true" ||
  process.env.ENABLE_AUTH_LEGACY === "1";

if (ENABLE_AUTH_LEGACY) {
  if (authRoutes) {
    use("/auth", authRoutes, "authRoutes"); // legacy public
  }
  if (auth) {
    // Optional: expose the new auth also under /api/auth-legacy for hard debugging
    use("/auth-legacy", auth, "auth-legacy");
  }
} else {
  console.log(
    "[routes] legacy auth routes DISABLED (set ENABLE_AUTH_LEGACY=true to enable)"
  );
}
// --- REPLACE END ---

// Users
// If `me` router defines /me, mount at root to expose /api/me
use("/", me, "me");

// Main user routes under /users → /api/users/*
use("/users", userRoutes, "userRoutes");

// --- REPLACE START: optional legacy users mount (to avoid double /api/users/*)
const ENABLE_USERS_LEGACY =
  process.env.ENABLE_USERS_LEGACY === "true" ||
  process.env.ENABLE_USERS_LEGACY === "1";

if (ENABLE_USERS_LEGACY && users) {
  use("/users", users, "users"); // legacy users router
} else if (users) {
  console.log(
    "[routes] legacy users router NOT mounted (set ENABLE_USERS_LEGACY=true to mount)"
  );
}
// --- REPLACE END ---

// Messages, likes, superlikes, rewind
// (we mount them under their own bases so they won't pollute /api/* with /:id style routes)
use("/messages", messages, "messages");
use("/likes", likes, "likes");

// --- REPLACE START: ENFORCE AUTH for both superlike variants ---
// Path-parameter variant: POST /api/superlike/:id
// Body-alias variant:     POST /api/superlikes  { targetUserId }
// These two must be protected with JWT. We require auth on both bases.
useAuth("/superlike", superlike, "superlike");
useAuth("/superlikes", superlikes, "superlikes");
// --- REPLACE END ---

use("/rewind", rewind, "rewind");

// Features
use("/dealbreakers", dealbreakers, "dealbreakers");
use("/search", search, "search");
use("/notifications", notifications, "notifications");
use("/moderation", moderation, "moderation");
use("/qa", qa, "qa");

// Discover
// ⚠️ IMPORTANT: Discover is mounted ONCE in app.js as `/api/discover`.
// If we mounted it here too, you'd again get 2× discover and shadowing.
// use('/discover', discoverRoutes, 'discoverRoutes');
// use('/discover', discoverLikesAlias, 'discoverLikesAlias');

// Images: this router already declares absolute paths (/users/:id/... and /images/:id/...)
// so we mount it at root.
use("/", imageRoutes, "imageRoutes");

// Intros (keep under dedicated base)
use("/intros", intros, "intros");

// Referral
use("/referral", referral, "referral");
use("/referral", referralRoutes, "referralRoutes");

// Social
use("/social", social, "social");
use("/social", socialRoutes, "socialRoutes");

// Billing under /billing → /api/billing/*
use("/billing", billing, "billing");

export default router;


