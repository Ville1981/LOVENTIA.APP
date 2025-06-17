// server/middleware/auth.js

const jwt = require("jsonwebtoken");
require("dotenv").config();

/**
 * Middleware: authenticateToken
 * - Expects header 'Authorization: Bearer <token>'
 * - Verifies JWT and attaches decoded payload to req.user and req.userId
 */
function authenticateToken(req, res, next) {
  // Accept either lowercase or uppercase header name
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("Authentication failed: No token provided (authHeader:", authHeader, ")");
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    console.error("Authentication failed: Malformed token header");
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach full payload and userId for downstream handlers
    req.user = decoded;
    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error("Authentication failed: Invalid token:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = authenticateToken;
