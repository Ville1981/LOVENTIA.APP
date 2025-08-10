// --- REPLACE START: JWT authenticate middleware (ESM) ---
/**
 * Authenticate requests using a Bearer access token.
 * - Looks for Authorization: Bearer <token>
 * - Verifies with JWT secret(s)
 * - Sets req.user = { userId, role, ...payload }
 *
 * Compatible with setups using either JWT_SECRET or ACCESS_TOKEN_SECRET.
 */

import jwt from 'jsonwebtoken';

/**
 * Returns the first defined value in the provided arguments.
 * This is used to choose between multiple possible env vars.
 */
function pickFirstDefined(...vals) {
  for (const v of vals) if (v) return v;
  return undefined;
}

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if not present or improperly formatted.
 */
function getAccessTokenFromReq(req) {
  const h = req?.headers?.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Express middleware that verifies a JWT and attaches the decoded payload
 * to req.user if valid. Otherwise, sends an appropriate error response.
 */
export default function authenticate(req, res, next) {
  try {
    const token = getAccessTokenFromReq(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization token' });
    }

    // Try common env var names; first non-empty wins
    const firstSecret = pickFirstDefined(process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET);
    const secretsToTry = [firstSecret, process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET].filter(Boolean);

    if (!secretsToTry.length) {
      // Fail closed with a clear error instead of silently allowing access
      return res.status(500).json({ error: 'Server JWT secret is not configured' });
    }

    let decoded = null;
    let lastErr = null;
    for (const secret of secretsToTry) {
      try {
        decoded = jwt.verify(token, secret);
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!decoded) {
      // Optionally log lastErr for server diagnostics
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = decoded.userId || decoded.sub || decoded.id;
    const role = decoded.role || 'user';

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Attach a normalized user object while preserving original claims
    req.user = { userId, role, ...decoded };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
// --- REPLACE END ---

