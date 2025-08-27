// server/middleware/authorize.js
/**
 * Middleware: authorizeRoles
 * @param  {...string} allowedRoles  Lista rooleista, joilla on pääsy
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    const role = req.userRole || req.user?.role;
    if (!role) {
      return res.status(403).json({ error: 'Rooli puuttuu, pääsy evätty' });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Ei oikeuksia suorittaa tätä toimintoa' });
    }
    next();
  };
}

module.exports = { authorizeRoles };
