// server/routes/me.js
// --- REPLACE START: /api/me route that returns current user with premium fields ---
import express from "express";
import authenticateToken from "../middleware/auth.js"; // assumes it sets req.userId
import User from "../models/User.js";

const router = express.Router();

/**
 * GET /api/me
 * Returns the currently authenticated user's public profile bits,
 * including premium status and stripeCustomerId.
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("_id email premium stripeCustomerId")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Normalize response shape
    res.json({
      id: user._id?.toString?.() || String(user._id),
      email: user.email || null,
      premium: !!user.premium,
      stripeCustomerId: user.stripeCustomerId || null,
    });
  } catch (err) {
    console.error("[/api/me] error:", err);
    res.status(500).json({ error: "Unable to fetch current user" });
  }
});

export default router;
// --- REPLACE END ---
