import express from 'express';

// --- REPLACE START: Import modules in a robust way and normalize their exports ---
// Central note: do NOT set CORS headers here. All CORS is handled by server/src/config/corsConfig.js.
// Some route files export using `export default router` (ESM),
// others may export as `{ router }` or `module.exports = router` (CJS interop compiled to ESM namespace).
// To avoid "does not provide an export named 'default'" errors, we import as namespace and pick the router.

function pickRouter(ns) {
  // Prefer ESM default, then a named `router`, else the namespace itself if it's a function
  return (ns && (ns.default || ns.router)) || (typeof ns === 'function' ? ns : null);
}

// Verified routes (present in your repo). Keep list explicit to avoid accidental duplicates.
import * as adminNS from './admin.js';
import * as adminMetricsNS from './adminMetrics.js';
import * as adminRoutesNS from './adminRoutes.js';
import * as authNS from './auth.js';
import * as authPrivateRoutesNS from './authPrivateRoutes.js';
import * as authRoutesNS from './authRoutes.js';
import * as billingNS from './billing.js';
import * as dealbreakersNS from './dealbreakers.js';
// ⚠️ Discover mounts are centralized in app.js to avoid duplicates/shadowing.
// import * as discoverLikesAliasNS from './discoverLikesAlias.js';
// import * as discoverRoutesNS from './discoverRoutes.js';
import * as healthRoutesNS from './healthRoutes.js';
import * as imageRoutesNS from './imageRoutes.js';
import * as introsNS from './intros.js';
import * as likesNS from './likes.js';
import * as meNS from './me.js';
// messages.js default-exports a router:
import * as messagesNS from './messages.js';
import * as metricsRoutesNS from './metricsRoutes.js';
import * as moderationNS from './moderation.js';
import * as notificationsNS from './notifications.js';
// og.js is mounted at root (/og) in app level; do not import it here under /api.
// payment.js and paypalWebhook.js require specific raw-body order; handled at app/webhooks level.
import * as qaNS from './qa.js';
import * as referralNS from './referral.js';
import * as referralRoutesNS from './referralRoutes.js';
import * as rewindNS from './rewind.js';
import * as searchNS from './search.js';
import * as socialNS from './social.js';
import * as socialRoutesNS from './socialRoutes.js';
// stripeWebhook.js requires raw-body; handled at app/webhooks level.
import * as superlikeNS from './superlike.js';
import * as superlikesNS from './superlikes.js';
import * as userRoutesNS from './userRoutes.js';
import * as usersNS from './users.js';

// Normalize to actual routers (functions/middleware)
const admin = pickRouter(adminNS);
const adminMetrics = pickRouter(adminMetricsNS);
const adminRoutes = pickRouter(adminRoutesNS);
const auth = pickRouter(authNS);
const authPrivateRoutes = pickRouter(authPrivateRoutesNS);
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
  if (!r || (typeof r !== 'function' && typeof r.use !== 'function')) {
    console.warn(`[routes] skipped ${name || path} (no valid router)`);
    return;
  }
  router.use(path, r);
  console.log(`[routes] mounted ${name || path} at ${path}`);
};

/**
 * NOTE on mount bases:
 * app.js uses `app.use('/api', routes)` → mounting at '/' here means they show under /api/*.
 * To restore canonical paths (e.g. /api/auth/login, /api/users/*), we mount routers
 * under their expected base prefixes below. Avoid duplicates and keep order stable.
 *
 * IMPORTANT: Do not set any Access-Control-Allow-* headers here. CORS is handled globally
 * by `server/src/config/corsConfig.js`, which is applied at the app level.
 */

// Health + metrics at root of /api
use('/', healthRoutes, 'healthRoutes');
use('/', metricsRoutes, 'metricsRoutes');

// Admin (mount base /admin so /api/admin/* resolves correctly)
use('/admin', admin, 'admin');
use('/admin', adminRoutes, 'adminRoutes');
// Metrics endpoints under /api/admin/metrics (if router itself exposes /metrics)
if (adminMetrics) {
  // If adminMetrics defines `/metrics`, mounting at /admin yields /api/admin/metrics
  use('/admin', adminMetrics, 'adminMetrics');
}

// Auth family under /auth → /api/auth/*
use('/auth', auth, 'auth');
use('/auth', authPrivateRoutes, 'authPrivateRoutes');
use('/auth', authRoutes, 'authRoutes');

// Users
// If `me` router defines /me, mount at root to expose /api/me
use('/', me, 'me');
// Main user routes under /users → /api/users/*
use('/users', userRoutes, 'userRoutes');
// Some projects keep a legacy `users` router — also mount under /users if present
use('/users', users, 'users');

// Messages, likes, superlikes, rewind
use('/messages', messages, 'messages');
use('/likes', likes, 'likes');
use('/superlikes', superlikes, 'superlikes');
use('/superlike', superlike, 'superlike'); // single-id variant
use('/rewind', rewind, 'rewind');

// Features
use('/dealbreakers', dealbreakers, 'dealbreakers');
use('/search', search, 'search');
use('/notifications', notifications, 'notifications');
use('/moderation', moderation, 'moderation');
use('/qa', qa, 'qa');

// Discover
// ⚠️ IMPORTANT: Discover is mounted ONCE in app.js as `/api/discover`.
// Commented out here to prevent double-mount and shadowing.
// use('/discover', discoverRoutes, 'discoverRoutes');
// use('/discover', discoverLikesAlias, 'discoverLikesAlias');

// Images: this router already declares absolute paths (/users/:id/... and /images/:id/...)
use('/', imageRoutes, 'imageRoutes');

// Intros (keep under a dedicated base to avoid clashes)
use('/intros', intros, 'intros');

// Referral
use('/referral', referral, 'referral');
use('/referral', referralRoutes, 'referralRoutes');

// Social
use('/social', social, 'social');
use('/social', socialRoutes, 'socialRoutes');

// Billing under /billing → /api/billing/*
use('/billing', billing, 'billing');

export default router;

