const User = require("../models/User");

// Whitelist of query parameters allowed for filtering
const allowedFilters = [
  "username",
  "age",
  "gender",
  "orientation",
  "religion",
  "religionImportance",
  "education",
  "profession",
  "country",
  "region",
  "city",
  "children",
  "pets",
  "summary",
  "goals",
  "lookingFor",
];

// GET /api/discover?username=&age=&gender=&city=... etc
exports.getDiscover = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const filters = {};

    // Build filters only from allowed query params
    Object.entries(req.query).forEach(([key, value]) => {
      if (
        value != null &&
        value !== "" &&
        allowedFilters.includes(key)
      ) {
        // Convert age to number
        filters[key] = key === "age" ? Number(value) : value;
      }
    });

    // Exclude current user's profile if authenticated
    if (currentUserId) {
      filters._id = { $ne: currentUserId };
    }

    // Fetch up to 20 profiles, omit sensitive fields
    const users = await User.find(filters)
      .limit(20)
      .select("-password -email -blockedUsers");

    // Return array of users directly
    return res.json(users);
  } catch (err) {
    console.error("getDiscover error:", err);
    return res
      .status(500)
      .json({ error: "Server error fetching discover profiles" });
  }
};

// POST /api/discover/:userId/:actionType
exports.handleAction = async (req, res) => {
  try {
    const { userId: targetId, actionType } = req.params;
    const currentUserId = req.userId;

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.sendStatus(404);
    }

    // Record action
    switch (actionType) {
      case "like":
        if (!user.likes.includes(targetId)) {
          user.likes.push(targetId);
        }
        break;
      case "pass":
        if (!user.passes.includes(targetId)) {
          user.passes.push(targetId);
        }
        break;
      case "superlike":
        if (!user.superLikes.includes(targetId)) {
          user.superLikes.push(targetId);
        }
        break;
      default:
        return res.status(400).json({ error: "Unknown action type" });
    }

    await user.save();
    return res.sendStatus(204);
  } catch (err) {
    console.error("handleAction error:", err);
    return res
      .status(500)
      .json({ error: "Server error recording action" });
  }
};
