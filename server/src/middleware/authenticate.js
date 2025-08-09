// --- REPLACE START: JWT authenticate middleware (ESM) ---
'use strict';

/**
 * Authenticate requests using a Bearer access token.
 * - Looks for Authorization: Bearer <token>
 * - Verifies with JWT secret(s)
 * - Sets req.user = { userId, role, ...payload }
 *
 * Compatible with setups using either JWT_SECRET or ACCESS_TOKEN_SECRET.
 */

import jwt from 'jsonwebtoken';

function pickFirstDefined(...vals) {
  for (const v of vals) if (v) return v;
  return undefined;
}

function getAccessTokenFromReq(req) {
  const h = req.headers && req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export default function authenticate(req, res, next) {
  try {
    const token = getAccessTokenFromReq(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization token' });
    }

    // Try both common env names to maximize compatibility
    const secretsToTry = [
      pickFirstDefined(process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET),
      // Fallbacks in case the first is unset; filter falsy later
      process.env.JWT_SECRET,
      process.env.ACCESS_TOKEN_SECRET,
    ].filter(Boolean);

    if (!secretsToTry.length) {
      // Don’t block test/dev if secret is missing; fail closed with 500 so it’s obvious
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
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = decoded.userId || decoded.sub || decoded.id;
    const role = decoded.role || 'user';

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = { userId, role, ...decoded };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
// --- REPLACE END ---
