const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 1) Varmistus, että pyyntö on autentikoitu
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    // Verify token and extract payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Attach userId for backwards compatibility
    req.userId = decoded.id;

    // Load the full user from DB (minus sensitive fields)
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Attach the user object so downstream handlers can use req.user directly
    req.user = user;
    next();

  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// 2) Varmistus admin-oikeudesta
const authorizeAdmin = (req, res, next) => {
  try {
    // req.user is guaranteed to exist if authenticate() passed
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admins only" });
    }
    next();
  } catch (err) {
    console.error("Authorization error:", err);
    return res.status(500).json({ error: "Server error during authorization" });
  }
};

// Default export is the authenticate function…
module.exports = authenticate;
// …and also expose both as named exports
module.exports.authenticate = authenticate;
module.exports.authorizeAdmin = authorizeAdmin;
