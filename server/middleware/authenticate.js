// middleware/authenticate.js

// --- REPLACE START: convert to ESM imports ---
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
// --- REPLACE END ---

/**
 * Middleware to protect routes by validating JWT in Authorization header.
 * Adds `req.user` containing the decoded token payload if valid.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// --- REPLACE START: export middleware as ESM default ---
export default authenticate;
// --- REPLACE END ---
