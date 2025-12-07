// PATH: server/src/routes/authPrivateRoutes.js
// CLEAN A-VERSION — minimal, safe, diagnostic only
// @ts-nocheck

import express from "express";
import authenticate from "../middleware/authenticate.js";
import jwt from "jsonwebtoken";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*  SAFE AUTH WRAPPER                                                         */
/* -------------------------------------------------------------------------- */
function ensureAuth(fn) {
  return (req, res, next) => {
    if (typeof fn === "function") return fn(req, res, next);
    return res.status(500).json({
      error: "Authenticate middleware not available",
      where: "authPrivateRoutes.ensureAuth",
    });
  };
}

/* -------------------------------------------------------------------------- */
/*  TOKEN HELPERS (diagnostics only)                                          */
/* -------------------------------------------------------------------------- */

function tokenFromHeader(req) {
  const h = req?.headers?.authorization;
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function tokenFromCookies(req) {
  const c = req?.cookies || {};
  return (
    c.accessToken ||
    c.token ||
    c.jwt ||
    c.refreshToken ||
    null
  );
}

function tokenFromQuery(req) {
  const q = req?.query || {};
  return q.token || q.access_token || q.accessToken || null;
}

function resolveToken(req) {
  return tokenFromHeader(req) || tokenFromCookies(req) || tokenFromQuery(req);
}

function decodeToken(req) {
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
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  ONLY DIAGNOSTIC ROUTE: /api/auth/private/ping                             */
/* -------------------------------------------------------------------------- */

router.get("/private/ping", ensureAuth(authenticate), (req, res) => {
  const decoded = decodeToken(req);
  const user = req.user || {};

  const resolvedId =
    user.userId ||
    user.id ||
    user._id ||
    decoded?.userId ||
    decoded?.id ||
    decoded?.sub ||
    decoded?.uid ||
    null;

  return res.json({
    ok: true,
    router: "authPrivateRoutes (CLEAN A-version)",
    message: "Private auth router is active.",
    user: {
      id: resolvedId,
      role: user.role || decoded?.role || "user",
      premium: !!(user.isPremium || user.premium || decoded?.isPremium),
    },
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

/* -------------------------------------------------------------------------- */
/*  IMPORTANT NOTE: NO `/me` HERE                                             */
/* -------------------------------------------------------------------------- */
//  The real /api/auth/me lives in server/routes/auth.js
//  This file must NEVER define /me, or it would shadow the real one.

export default router;

