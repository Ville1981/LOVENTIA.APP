// --- REPLACE START: role-based authorization middleware (ESM with CJS fallback) ---
/**
 * authorizeRoles(...allowed)
 * Allows request to proceed only if req.user.role is one of the allowed roles.
 * If no roles are provided, middleware is a no-op (allows all).
 *
 * Usage (ESM):
 *   import authorizeRoles from "./roleAuthorization.js";
 *
 * Backward compatibility:
 *   - Also provides a named export.
 *   - Exposes CommonJS fallback if required from CJS via `module.exports`.
 */
function authorizeRoles(...allowed) {
  // Support both signatures:
  //   authorizeRoles('admin', 'user')  OR  authorizeRoles(['admin','user'])
  if (allowed.length === 1 && Array.isArray(allowed[0])) {
    allowed = allowed[0];
  }

  // No roles specified → allow all
  if (!allowed.length) {
    return (_req, _res, next) => next();
  }

  return function (req, res, next) {
    try {
      const role = req && req.user && req.user.role;
      if (!role) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!allowed.includes(role)) {
        return res.status(403).json({ error: "Insufficient role" });
      }
      return next();
    } catch (_err) {
      return res.status(403).json({ error: "Forbidden" });
    }
  };
}

// ESM exports
export default authorizeRoles;
export { authorizeRoles };

/* CommonJS fallback (safe in ESM runtime due to typeof guard) */
try {
  // If this file is accidentally loaded via require(), expose CJS exports.
  if (typeof module !== "undefined" && module.exports) {
    // --- REPLACE START: switch to ESM default export (identifier) ---
// --- REPLACE START: removed duplicate default export ---

// --- REPLACE END --- authorizeRoles;
// --- REPLACE END ---            // require('./roleAuthorization')
    module.exports.default = authorizeRoles;    // require(...).default
    module.exports.authorizeRoles = authorizeRoles; // require(...).authorizeRoles
  }
} catch {
  /* no-op */
}
// --- REPLACE END ---
