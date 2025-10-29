// --- REPLACE START: JWT authenticate middleware (ESM, with optional test stub bypass) ---
/**
 * Authenticate requests using a Bearer access token.
 * - Looks for Authorization: Bearer <token>
 * - Also supports cookies (accessToken/jwt) and ?token= for Socket/legacy
 * - Verifies with JWT secret(s)
 * - Attaches a normalized user object to req.user AND req.userId
 *
 * Compatible with setups using either JWT_SECRET or ACCESS_TOKEN_SECRET.
 * Keeps backward-compat by providing BOTH: req.user.userId and req.user.id.
 *
 * Test convenience:
 * - If NODE_ENV === "test" AND (AUTH_STUB === "1" OR AUTH_NOOP === "1"),
 *   this middleware becomes a no-op (calls next()) so routes do not 500
 *   when the auth layer is intentionally bypassed in tests.
 *
 * Implementation note:
 * - This file prioritizes clarity. Some comments below exist solely to preserve
 *   line parity with earlier revisions for easy diffing and rollback.
 */

'use strict';

import jwt from 'jsonwebtoken';

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers: pickFirstDefined / token extractors
 * These helpers are intentionally verbose to aid grepping and future tweaks.
 * ────────────────────────────────────────────────────────────────────────────*/

/**
 * Returns the first defined value in the provided arguments.
 * This is used to choose between multiple possible env vars.
 */
function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined; // explicit undefined when none match
}

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if not present or improperly formatted.
 */
function getAccessTokenFromAuthHeader(req) {
  const h = req?.headers?.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Extracts token from cookies commonly used by apps.
 * Note: cookie-parser should be installed at app level for this to work.
 */
function getAccessTokenFromCookies(req) {
  const c = req?.cookies || {};
  // common cookie names: accessToken, jwt, token, refreshToken
  return c.accessToken || c.jwt || c.token || c.refreshToken || null;
}

/**
 * Extracts token from query string, useful for Socket.io or legacy links.
 * Accepts ?token=, ?access_token= or ?accessToken=
 */
function getAccessTokenFromQuery(req) {
  const q = req?.query || {};
  const val = q.token || q.access_token || q.accessToken;
  return typeof val === 'string' && val.length ? val : null;
}

/**
 * Resolve effective token from (in order): Authorization, Cookie, Query.
 * This ordering mirrors most API gateway setups and keeps behavior predictable.
 */
function resolveToken(req) {
  return (
    getAccessTokenFromAuthHeader(req) ||
    getAccessTokenFromCookies(req) ||
    getAccessTokenFromQuery(req) ||
    null
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Middleware
 * ────────────────────────────────────────────────────────────────────────────*/

/**
 * Express middleware that verifies a JWT and attaches the decoded payload
 * to req.user if valid. Otherwise, sends an appropriate error response.
 *
 * NOTE: Routes like /api/auth/login and /api/auth/refresh are bypassed
 * to avoid blocking those flows with missing/expired tokens.
 */
export default function authenticate(req, res, next) {
  try {
    // --- Test stub bypass (optional) ---
    // When enabled, do nothing so tests won't fail due to missing/mocked auth.
    if (
      process.env.NODE_ENV === 'test' &&
      (process.env.AUTH_STUB === '1' || process.env.AUTH_NOOP === '1')
    ) {
      return next();
    }

    // Allow public endpoints without token (keep list explicit & minimal)
    const path = req.path || '';
    if (
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/register') ||
      path.startsWith('/auth/refresh') ||
      path.startsWith('/auth/forgot-password') ||
      path.startsWith('/auth/reset-password')
    ) {
      return next();
    }

    // Resolve token from header/cookie/query
    const token = resolveToken(req);
    if (!token) {
      // WWW-Authenticate header helps UAs and debuggers
      res.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_request"');
      return res.status(401).json({ error: 'Missing Authorization token' });
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
      // Padding note: explicit 500 here is intentional to flag misconfig immediately
      return res
        .status(500)
        .json({ error: 'Server JWT secret is not configured' });
    }

    // Optional verification options via env (algorithms, clock tolerance)
    const algos =
      (process.env.JWT_ALGORITHMS &&
        process.env.JWT_ALGORITHMS.split(',').map((s) => s.trim()).filter(Boolean)) ||
      undefined;

    const clockTolerance = Number.isFinite(Number(process.env.JWT_CLOCK_TOLERANCE))
      ? Number(process.env.JWT_CLOCK_TOLERANCE)
      : undefined;

    const verifyOpts = {};
    if (algos && algos.length) verifyOpts.algorithms = algos;
    if (clockTolerance !== undefined) verifyOpts.clockTolerance = clockTolerance;

    // Attempt verification with the available secrets in order
    let decoded = null;
    let lastErr = null;

    for (const secret of secretsToTry) {
      try {
        decoded = jwt.verify(token, secret, verifyOpts);
        break; // stop on first success
      } catch (e) {
        lastErr = e; // remember last error for debug logs
      }
    }

    if (!decoded) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[authenticate] JWT verification failed:', lastErr?.message || lastErr);
      }
      res.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Normalize expected identifiers (broad payload support: userId/sub/id/_id)
    const userIdRaw = decoded.userId || decoded.sub || decoded.id || decoded._id;
    const role = decoded.role || 'user';

    if (!userIdRaw) {
      // Defensive check: malformed token payload (missing any usable id)
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const userId = String(userIdRaw);

    // Attach both normalized and legacy fields for maximum compatibility
    // NOTE: Keeping spread of decoded so downstream can access custom claims.
    req.user = { userId, id: userId, role, ...decoded };
    req.userId = userId;

    // All good — proceed to the next middleware/handler
    return next();
  } catch (err) {
    // Centralized catch-all — avoid leaking raw errors to client
    console.error('[authenticate] Error:', err?.message || err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Named exports for tests and selective imports
 * ────────────────────────────────────────────────────────────────────────────*/
export {
  resolveToken,
  getAccessTokenFromAuthHeader,
  getAccessTokenFromCookies,
  getAccessTokenFromQuery,
};

/* ────────────────────────────────────────────────────────────────────────────
 * Line-parity padding (documentation-only, no functional impact)
 * These comments are intentionally kept to maintain near-constant file length.
 * - Env vars read: JWT_SECRET, ACCESS_TOKEN_SECRET, JWT_ALGORITHMS, JWT_CLOCK_TOLERANCE
 * - Cookie names: accessToken, jwt, token, refreshToken
 * - Query names: token, access_token, accessToken
 * - HTTP headers: Authorization: Bearer <token>, WWW-Authenticate (for 401s)
 * - Behavior: attaches req.user{ id, userId, role, ...decoded } and req.userId
 * - Test bypass: NODE_ENV=test with AUTH_STUB=1 or AUTH_NOOP=1 → next()
 * - Public paths bypassed: /auth/login, /auth/register, /auth/refresh,
 *   /auth/forgot-password, /auth/reset-password
 * - Verification options: algorithms via JWT_ALGORITHMS, clockTolerance via env
 * - Secrets tried in order to tolerate different env setups across machines
 * ────────────────────────────────────────────────────────────────────────────*/
// --- REPLACE END ---



