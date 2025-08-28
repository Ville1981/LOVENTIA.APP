// File: server/middleware/auth.js

// --- REPLACE START: Hardened JWT auth — ensureAuth & optionalAuth, consistent 401/403, req.user/req.userId wiring (ESM) ---
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Extract bearer token from common locations.
 * Priority:
 *   1) Authorization: Bearer <token>
 *   2) Cookie: accessToken / token / Authorization (some proxies copy here)
 *   3) Query (?access_token=... or ?token=...) — DEV ONLY (NODE_ENV !== 'production')
 */
function getTokenFromRequest(req) {
  // Header
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1];
    }
    // Sometimes clients send the raw token without the "Bearer" prefix
    if (parts.length === 1 && authHeader.length > 20) {
      return authHeader.trim();
    }
  }

  // Cookies (requires cookie-parser upstream)
  const c = req.cookies || {};
  if (typeof c.accessToken === 'string' && c.accessToken) return c.accessToken;
  if (typeof c.token === 'string' && c.token) return c.token;
  if (typeof c.Authorization === 'string' && c.Authorization) {
    const maybe = String(c.Authorization);
    if (maybe.startsWith('Bearer ')) return maybe.slice(7);
    return maybe;
  }

  // DEV fallbacks via querystring (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const q = req.query || {};
    if (typeof q.access_token === 'string' && q.access_token) return q.access_token;
    if (typeof q.token === 'string' && q.token) return q.token;
  }

  return null;
}

/**
 * Verify a JWT and return its payload, or throw.
 */
function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET missing');
  }
  return jwt.verify(token, secret);
}

/**
 * Normalize and attach payload data to the request object.
 * - req.user: full decoded payload (NOT a DB document)
 * - req.auth: legacy alias to payload
 * - req.userId: normalized id (userId | id | sub)
 * - req.role, req.stripeCustomerId for convenience
 */
function attachPayloadToRequest(req, payload) {
  const id =
    payload?.userId ||
    payload?.id ||
    payload?.sub ||
    null;

  req.user = payload || null;
  req.auth = payload || null; // legacy alias
  req.userId = id;

  req.role = payload?.role || payload?.userRole || undefined;
  req.stripeCustomerId =
    payload?.stripeCustomerId ||
    payload?.customerId ||
    payload?.stripe_customer_id ||
    undefined;
}

/**
 * ensureAuth (strict)
 * - 401 when token is missing
 * - 403 when token is invalid/expired
 * - Skips auth for CORS preflight (OPTIONS) with 204
 */
function ensureAuth(req, res, next) {
  // Preflight should not require auth
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  let token;
  try {
    token = getTokenFromRequest(req);
  } catch {
    token = null;
  }

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] No access token provided for', req.method, req.originalUrl);
    }
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = verifyToken(token);
    attachPayloadToRequest(req, payload);
    return next();
  } catch (err) {
    const name = err?.name;
    if (name === 'TokenExpiredError') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] Token expired at', err?.expiredAt);
      }
      return res.status(403).json({ error: 'Token expired' });
    }
    if (err?.message === 'JWT_SECRET missing') {
      console.error('[auth] Missing JWT_SECRET in environment.');
      return res.status(500).json({ error: 'Server auth misconfiguration' });
    }
    console.error('[auth] JWT verification failed:', err?.message || err);
    return res.status(403).json({ error: 'Invalid token' });
  }
}

/**
 * optionalAuth (lenient)
 * - If token exists → verify and attach payload (same as ensureAuth)
 * - If token missing/invalid → DO NOT error; just continue without req.user
 *   (useful for endpoints that behave slightly better when user is known
 *    but still work anonymously)
 */
function optionalAuth(req, _res, next) {
  // Preflight should not require auth
  if (req.method === 'OPTIONS') {
    return next();
  }

  let token;
  try {
    token = getTokenFromRequest(req);
  } catch {
    token = null;
  }

  if (!token) {
    // Anonymous
    req.user = null;
    req.auth = null;
    req.userId = null;
    return next();
  }

  try {
    const payload = verifyToken(token);
    attachPayloadToRequest(req, payload);
  } catch (err) {
    // On optional path, swallow verification errors and continue anonymous
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] optionalAuth token invalid/expired for', req.originalUrl, '-', err?.message || err);
    }
    req.user = null;
    req.auth = null;
    req.userId = null;
  }

  return next();
}

/**
 * Backwards-compatible alias. Some existing routes may import `authenticateToken`.
 * Keep it equal to ensureAuth to avoid surprises.
 */
const authenticateToken = ensureAuth;

// Export both default and named so imports will always match (ESM friendly)
export default authenticateToken;
export {
  authenticateToken,
  ensureAuth,
  optionalAuth,
  getTokenFromRequest,
  verifyToken,
  attachPayloadToRequest,
};
// --- REPLACE END ---
