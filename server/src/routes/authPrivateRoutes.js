// PATH: server/src/routes/authPrivateRoutes.js
// @ts-nocheck

// --- REPLACE START: private auth routes (ESM, no top-level await, no /me shadowing) ---
/**
 * Private Auth Routes
 * ===================
 *
 * Purpose of THIS file:
 * - keep the private/auth-only endpoints alive so that the mount in
 *   `server/src/routes/index.js` → `use('/auth', authPrivateRoutes, 'authPrivateRoutes');`
 *   does not break
 * - expose 1–2 simple protected endpoints so we can verify that:
 *     1) authenticate() works
 *     2) token is parsed
 *     3) req.user is present
 * - DO **NOT** redefine `/me` here, because the *real* `/api/auth/me` is now
 *   implemented in **server/routes/auth.js** (the big ESM router you just updated)
 *   and that one already normalizes the user, adds premium flags, entitlements, etc.
 *
 * Why not redefine /me here?
 * - If we put `router.get('/me', ...)` again in this file, depending on mount order,
 *   this simpler version could answer first with 501 or with a less complete payload.
 *   That is exactly the problem we just fixed.
 *
 * So: this file stays, routes stay, but we keep them clearly “private utility” routes.
 */

import express from "express";
// --- REPLACE START: tolerate missing/legacy authenticate + allow CJS export shape ---
import authenticate from "../middleware/authenticate.js";
import jwt from "jsonwebtoken";
// --- REPLACE END ---
import authController from "../api/controllers/authController.js";

// We may want premium / role checks here later, so keep it as a reusable helper.
const router = express.Router();

/**
 * Safe auth wrapper – in case authenticate import fails or is not a function.
 * We keep your pattern of “do not crash, return clear JSON”.
 *
 * NOTE:
 * We also keep a small token-based fallback below for the ping route, in case
 * authenticate is mounted but did not populate req.user (older middlewares).
 */
const ensureAuth =
  (fn) =>
  (req, res, next) => {
    if (typeof fn === "function") {
      return fn(req, res, next);
    }
    return res.status(500).json({
      error: "Authenticate middleware not available",
      where: "authPrivateRoutes.ensureAuth",
    });
  };

/**
 * Helper: pick first defined value (same idea as in the big auth router)
 */
function pickFirstDefined(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/**
 * Helper: resolve token from header/cookie/query (same style as main auth router)
 */
function tokenFromAuthHeader(req) {
  const h = req?.headers?.authorization;
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
function tokenFromCookies(req) {
  const c = req?.cookies || {};
  return (
    c.accessToken ||
    c.jwt ||
    c.token ||
    c.refreshToken ||
    null
  );
}
function tokenFromQuery(req) {
  const q = req?.query || {};
  const v = q.token || q.access_token || q.accessToken;
  return typeof v === "string" && v.length ? v : null;
}
function resolveToken(req) {
  return (
    tokenFromAuthHeader(req) ||
    tokenFromCookies(req) ||
    tokenFromQuery(req) ||
    null
  );
}

/**
 * Helper: decode token just for diagnostics (NOT for auth)
 * We do this only in /private/ping to show what userId is actually in token.
 */
function decodeTokenIfPossible(req) {
  const token = resolveToken(req);
  if (!token) return null;
  const secret =
    process.env.JWT_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    process.env.JWT_REFRESH_SECRET ||
    process.env.REFRESH_TOKEN_SECRET ||
    "dev_access_secret";
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    // do not crash, just return null
    return null;
  }
}

/**
 * 1) Diagnostic private ping
 * --------------------------
 * Final path: GET /api/auth/private/ping
 * Requires: valid auth token → authenticate must populate req.user
 *
 * We ALSO show:
 * - what token we decoded (if any)
 * - what id fields are present
 * so that we can confirm that login/refresh really pack sub/id/userId/uid.
 */
router.get("/private/ping", ensureAuth(authenticate), (req, res) => {
  const decoded = decodeTokenIfPossible(req);

  // --- REPLACE START: prefer same id packing as in authController + routes/auth.js ---
  const resolvedId =
    req.user?.userId ||
    req.user?.id ||
    req.user?._id ||
    pickFirstDefined(req.user?.sub, req.user?.uid) ||
    (decoded &&
      (decoded.userId ||
        decoded.id ||
        decoded.sub ||
        decoded.uid ||
        decoded._id)) ||
    null;
  // --- REPLACE END ---

  return res.json({
    ok: true,
    router: "authPrivateRoutes",
    message: "Private auth router is mounted.",
    note: "Main /api/auth/me is handled by server/routes/auth.js (do not redefine here).",
    user: {
      id: resolvedId,
      role: req.user?.role || decoded?.role || "user",
      premium: !!(req.user?.isPremium || req.user?.premium || decoded?.isPremium || decoded?.premium),
    },
    // expose decoded (safe) so we see what came from token – helps PS debug
    decoded: decoded
      ? {
          sub: decoded.sub || null,
          id: decoded.id || null,
          userId: decoded.userId || null,
          uid: decoded.uid || null,
          email: decoded.email || null,
          role: decoded.role || null,
          isPremium: !!(decoded.isPremium || decoded.premium),
        }
      : null,
  });
});

/**
 * 2) Optional: private “update my security” endpoint
 * -------------------------------------------------
 * We keep this light and **optional**. If the controller has such a method,
 * we forward to it. If not, we return 501 instead of 404.
 *
 * Final path: POST /api/auth/private/update
 * Idea: later you can hook MFA, change-email-confirm, revoke-sessions, etc.
 */
router.post(
  "/private/update",
  ensureAuth(authenticate),
  (req, res, next) => {
    // If controller exists and exposes a method → forward
    if (
      authController &&
      (typeof authController.updatePrivate === "function" ||
        typeof authController.updateSecure === "function")
    ) {
      // pick whichever name exists
      const fn =
        authController.updatePrivate || authController.updateSecure;
      return fn(req, res, next);
    }

    // Otherwise just say “not implemented here”
    return res.status(501).json({
      error: "Private update endpoint not implemented in authController",
      hint: "Add updatePrivate/updateSecure to ../api/controllers/authController.js",
    });
  }
);

/**
 * 3) Explicit NO /me here
 * -----------------------
 * We add a **visible** route to explain this, so you remember in 3 months.
 *
 * GET /api/auth/private/no-me
 */
router.get("/private/no-me", ensureAuth(authenticate), (_req, res) => {
  return res.json({
    ok: true,
    info: "This private router intentionally does NOT define /me.",
    use: "/api/auth/me",
    reason:
      "We want the single, normalized, premium-aware /api/auth/me from server/routes/auth.js",
  });
});

// --- REPLACE END ---

export default router;

