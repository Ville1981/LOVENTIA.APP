// server/middleware/auth.js

// --- REPLACE START: convert to ES modules and export default & named ---
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

/**
 * authenticateToken middleware
 * - Expects header "Authorization: Bearer <token>"
 * - Verifies JWT, attaches payload to req.user and req.userId
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.error('Authentication failed: no token provided');
    return res.status(401).json({ error: 'Access token required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    req.userId = payload.id;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Export both default and named so imports will always match
export default authenticateToken;
export { authenticateToken };
// --- REPLACE END ---
