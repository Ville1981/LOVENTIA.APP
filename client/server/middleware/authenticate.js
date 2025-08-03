const jwt = require('jsonwebtoken');

/**
 * Simple Express middleware to authenticate by JWT.
 * On success, attaches decoded payload to req.user.
 */
function authenticate(req, res, next) {
  // --- REPLACE START: no changes needed here; kept for consistency ---
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = auth.slice(7);
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = payload; // e.g. { id, email, ... }
    next();
  });
  // --- REPLACE END ---
}

module.exports = authenticate;
