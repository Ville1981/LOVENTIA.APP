// File: server/src/middleware/authenticate.js

// --- REPLACE START: JWT authenticate middleware (ESM, with login/refresh bypass) ---
/**
 * Authenticate requests using a Bearer access token.
 * - Looks for Authorization: Bearer <token>
 * - Also supports cookies (accessToken/jwt) and ?token= for Socket/legacy
 * - Verifies with JWT secret(s)
 * - Attaches a normalized user object to req.user AND req.userId
 *
 * Compatible with setups using either JWT_SECRET or ACCESS_TOKEN_SECRET.
 * Keeps backward-compat by providing BOTH: req.user.userId and req.user.id.
 */

import jwt from "jsonwebtoken";

/**
 * Returns the first defined value in the provided arguments.
 * This is used to choose between multiple possible env vars.
 */
function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
}

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if not present or improperly formatted.
 */
function getAccessTokenFromAuthHeader(req) {
  const h = req?.headers?.authorization;
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Extracts token from cookies commonly used by apps.
 */
function getAccessTokenFromCookies(req) {
  const c = req?.cookies || {};
  // common cookie names: accessToken, jwt, token, refreshToken
  return c.accessToken || c.jwt || c.token || c.refreshToken || null;
}

/**
 * Extracts token from query string, useful for Socket.io or legacy links.
 */
function getAccessTokenFromQuery(req) {
  const q = req?.query || {};
  const val = q.token || q.access_token || q.accessToken;
  return typeof val === "string" && val.length ? val : null;
}

/**
 * Resolve effective token from (in order): Authorization, Cookie, Query.
 */
function resolveToken(req) {
  return (
    getAccessTokenFromAuthHeader(req) ||
    getAccessTokenFromCookies(req) ||
    getAccessTokenFromQuery(req) ||
    null
  );
}

/**
 * Express middleware that verifies a JWT and attaches the decoded payload
 * to req.user if valid. Otherwise, sends an appropriate error response.
 *
 * NOTE: Routes like /api/auth/login and /api/auth/refresh are bypassed
 * to avoid blocking those flows with missing/expired tokens.
 */
export default function authenticate(req, res, next) {
  try {
    // Allow public endpoints without token
    const path = req.path || "";
    if (
      path.startsWith("/auth/login") ||
      path.startsWith("/auth/register") ||
      path.startsWith("/auth/refresh") ||
      path.startsWith("/auth/forgot-password") ||
      path.startsWith("/auth/reset-password")
    ) {
      return next();
    }

    const token = resolveToken(req);
    if (!token) {
      res.set(
        "WWW-Authenticate",
        'Bearer realm="api", error="invalid_request"'
      );
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    // Try common env var names; first non-empty wins
    const firstSecret = pickFirstDefined(
      process.env.JWT_SECRET,
      process.env.ACCESS_TOKEN_SECRET
    );
    const secretsToTry = [
      firstSecret,
      process.env.JWT_SECRET,
      process.env.ACCESS_TOKEN_SECRET,
    ].filter(Boolean);

    if (!secretsToTry.length) {
      return res
        .status(500)
        .json({ error: "Server JWT secret is not configured" });
    }

    // Optional verification options via env
    const algos =
      (process.env.JWT_ALGORITHMS &&
        process.env.JWT_ALGORITHMS.split(",")
          .map((s) => s.trim())
          .filter(Boolean)) ||
      undefined;

    const clockTolerance = Number.isFinite(
      Number(process.env.JWT_CLOCK_TOLERANCE)
    )
      ? Number(process.env.JWT_CLOCK_TOLERANCE)
      : undefined;

    const verifyOpts = {};
    if (algos && algos.length) verifyOpts.algorithms = algos;
    if (clockTolerance !== undefined) verifyOpts.clockTolerance = clockTolerance;

    let decoded = null;
    let lastErr = null;

    for (const secret of secretsToTry) {
      try {
        decoded = jwt.verify(token, secret, verifyOpts);
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!decoded) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[authenticate] JWT verification failed:",
          lastErr?.message || lastErr
        );
      }
      res.set(
        "WWW-Authenticate",
        'Bearer realm="api", error="invalid_token"'
      );
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Normalize expected identifiers
    const userIdRaw =
      decoded.userId || decoded.sub || decoded.id || decoded._id;
    const role = decoded.role || "user";

    if (!userIdRaw) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const userId = String(userIdRaw);
    req.user = { userId, id: userId, role, ...decoded };
    req.userId = userId;

    return next();
  } catch (err) {
    console.error("[authenticate] Error:", err?.message || err);
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export {
  resolveToken,
  getAccessTokenFromAuthHeader,
  getAccessTokenFromCookies,
  getAccessTokenFromQuery,
};
// --- REPLACE END ---

















