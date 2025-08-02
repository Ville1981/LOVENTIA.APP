const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify that the incoming request has a valid JWT access token.
 * Attaches `req.userId` and `req.user` on success.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verifyErr) {
      console.error('Token verification failed:', verifyErr);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Backward compatibility: attach raw user ID
    req.userId = decoded.id;

    // Load user from database (excluding password)
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach the full user object for downstream handlers
    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication middleware error:', err.stack || err);
    return res.status(500).json({ error: 'Server error during authentication' });
  }
};

/**
 * Middleware to authorize only admin users.
 * Must be used after `authenticate`.
 */
const authorizeAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admins only' });
    }

    next();
  } catch (err) {
    console.error('Authorization middleware error:', err.stack || err);
    return res.status(500).json({ error: 'Server error during authorization' });
  }
};

// Default export: authenticate middleware
module.exports = authenticate;
// Named exports
module.exports.authenticate = authenticate;
module.exports.authorizeAdmin = authorizeAdmin;
