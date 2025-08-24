// --- REPLACE START: role-based authorization middleware (CommonJS) ---
/**
 * authorizeRoles(...allowed)
 * Allows request to proceed only if req.user.role is one of the allowed roles.
 * If no roles are provided, middleware is a no-op (allows all).
 */
module.exports = function authorizeRoles(...allowed) {
  // If used as app-level middleware with array, support both signatures:
  //   authorizeRoles('admin', 'user')  OR  authorizeRoles(['admin','user'])
  if (allowed.length === 1 && Array.isArray(allowed[0])) {
    allowed = allowed[0];
  }

  // No roles specified → allow all (useful default)
  if (!allowed.length) {
    return (req, res, next) => next();
  }

  return function (req, res, next) {
    try {
      const role = req.user && req.user.role;
      if (!role) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!allowed.includes(role)) {
        return res.status(403).json({ error: 'Insufficient role' });
      }
      return next();
    } catch (_) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  };
};
// --- REPLACE END ---
