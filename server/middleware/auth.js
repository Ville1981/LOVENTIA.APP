// File: src/middleware/authenticate.js

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
  if (!authHeader || typeof authHeader !== "string") {
    console.error(
      "Authentication failed: No Authorization header provided",
      "headers:", req.headers
    );
    return res.status(401).json({ error: "No token provided" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    console.error("Authentication failed: Malformed Authorization header", authHeader);
    return res.status(401).json({ error: "Malformed token" });
  }

  const token = parts[1];
  if (!token) {
    console.error("Authentication failed: Token missing after Bearer");
    return res.status(401).json({ error: "No token provided" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("Authentication failed: JWT_SECRET is not defined");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach full payload and userId for downstream handlers
    req.user = decoded;
    req.userId = decoded.id;
    if (decoded.role) {
      req.userRole = decoded.role;
    }
    next();
  } catch (err) {
    console.error("Authentication failed: Invalid token:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = authenticateToken;

