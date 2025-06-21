const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { getDiscover, handleAction } = require("../controllers/discoverController");

// Valid action types for POST requests
const validActions = ["pass", "like", "superlike"];

// GET /api/discover
// Public: returns filtered user list
router.get("/", getDiscover);

// POST /api/discover/:userId/:actionType
// Authenticated: record like, pass, or superlike action
router.post(
  "/:userId/:actionType",
  authenticateToken,
  (req, res, next) => {
    const { actionType } = req.params;
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: "Invalid action type" });
    }
    next();
  },
  handleAction
);

module.exports = router;
