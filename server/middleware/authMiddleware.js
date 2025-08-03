// server/middleware/authMiddleware.js

import jwt from 'jsonwebtoken';
import 'dotenv/config';

/**
 * Middleware: authenticate
 * - Expects header 'Authorization: Bearer <token>'
 * - Verifies JWT and attaches decoded payload to req.user and req.userId
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    console.error('Authentication failed: No Authorization header provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.error('Authentication failed: Malformed Authorization header', authHeader);
    return res.status(401).json({ error: 'Malformed token' });
  }

  const token = parts[1];
  if (!process.env.JWT_SECRET) {
    console.error('Authentication failed: JWT_SECRET not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.id) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    req.user = payload;
    req.userId = payload.id;
    next();
  } catch (err) {
    console.error('Authentication failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: authorizeAdmin
 * - Ensures the authenticated user has admin role
 */
export function authorizeAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admins only' });
  }
  next();
}

// Default export for compatibility
export default authenticate;
