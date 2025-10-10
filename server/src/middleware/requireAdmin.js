// File: server/src/middleware/requireAdmin.js

// --- REPLACE START: simple admin/role guard (JWT must already be verified) ---
/**
 * Require admin access. Assumes an upstream auth middleware has set `req.user`.
 * Accepts either `user.role === 'admin'` or boolean `user.isAdmin === true`.
 */
export default function requireAdmin(req, res, next) {
  try {
    const u = req.user || {};
    const isAdmin = u.role === 'admin' || u.isAdmin === true;
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
// --- REPLACE END ---
