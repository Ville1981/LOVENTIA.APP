// File: server/src/middleware/adminOnly.js

// --- REPLACE START: simple admin-only guard (assumes req.user.role) ---
export default function adminOnly(req, res, next) {
  try {
    // Many apps attach user on req.user (from auth middleware). Adjust if you use res.locals.user, etc.
    const role = req.user?.role || req.user?.isAdmin ? "admin" : req.user?.role;
    if (role === "admin" || req.user?.isAdmin === true) {
      return next();
    }
    return res.status(403).json({ error: "Admin privileges required." });
  } catch {
    return res.status(401).json({ error: "Unauthorized." });
  }
}
// --- REPLACE END ---
