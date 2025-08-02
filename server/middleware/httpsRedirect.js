// server/src/middleware/httpsRedirect.js

/**
 * Middleware to redirect HTTP requests to HTTPS in production.
 *
 * Usage: app.use(require('./middleware/httpsRedirect'));
 */
function httpsRedirect(req, res, next) {
  // Only enforce in production
  if (process.env.NODE_ENV === 'production') {
    // Check forwarded proto (e.g., behind proxy) or req.protocol
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto !== 'https') {
      // Permanently redirect to same host & URL over HTTPS
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
  }
  next();
}

module.exports = httpsRedirect;
