const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 1) Varmistus, että pyyntö on autentikoitu
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// 2) Varmistus admin-oikeudesta
const authorizeAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admins only" });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: "Server error during authorization" });
  }
};

module.exports = { authenticate, authorizeAdmin };
