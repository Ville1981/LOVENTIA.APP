// server/src/middleware/roleAuthorization.js

/**
 * Middleware to restrict access based on user roles.
 * Usage: app.use('/admin', authorizeRoles('admin'), adminRouter);
 *
 * @param  {...string} allowedRoles - list of roles permitted to access the route
 * @returns {Function} Express middleware
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    // Assume req.user is already populated by authentication middleware
    const user = req.user;

    if (!user) {
      // User must be authenticated first
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(user.role)) {
      // User does not have one of the allowed roles
      return res.status(403).json({ error: 'Forbidden: insufficient privileges' });
    }

    // User is authorized
    next();
  };
}

module.exports = authorizeRoles;
