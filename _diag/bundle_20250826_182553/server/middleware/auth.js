// File: server/middleware/auth.js

// --- REPLACE START: Hardened JWT auth — consistent 401/403 + req.user/req.userId wiring (ESM) ---
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
    // Sometimes clients send the raw token in Authorization without "Bearer"
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
 * authenticateToken middleware
 * - 401 when token is missing
 * - 403 when token is invalid/expired
 * - Attaches payload to req.user, req.userId (and legacy aliases)
 * - Passes through CORS preflight (OPTIONS) without auth
 */
function authenticateToken(req, res, next) {
  // Preflight should not require auth
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  // Ensure we have a secret early (prevents confusing "jwt must be provided" messages)
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[auth] Missing JWT_SECRET in environment.');
    return res.status(500).json({ error: 'Server auth misconfiguration' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    // Keep log concise; do not dump headers for security
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] No access token provided for', req.method, req.originalUrl);
    }
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwt.verify(token, secret);

    // Normalize common fields
    const id =
      payload.userId ||
      payload.id ||
      payload.sub || // JWT sub often holds user id
      null;

    // Attach for downstream handlers
    req.user = payload;
    req.auth = payload;      // legacy alias used by some routes
    req.userId = id;

    // Helpful mirrors for common props (tolerant if undefined)
    req.role = payload.role || payload.userRole || undefined;
    req.stripeCustomerId =
      payload.stripeCustomerId ||
      payload.customerId ||
      payload.stripe_customer_id ||
      undefined;

    return next();
  } catch (err) {
    // Distinguish expiry vs invalid
    const name = err && err.name;
    if (name === 'TokenExpiredError') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] Token expired at', err.expiredAt);
      }
      return res.status(403).json({ error: 'Token expired' });
    }
    console.error('[auth] JWT verification failed:', err && err.message ? err.message : err);
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Export both default and named so imports will always match
export default authenticateToken;
export { authenticateToken };
// --- REPLACE END ---
