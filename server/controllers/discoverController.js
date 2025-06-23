// server/controllers/discoverController.js
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

exports.getDiscover = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const filters = {};

    // Build filters only from allowed query params
    Object.entries(req.query).forEach(([key, value]) => {
      if (value != null && value !== "" && allowedFilters.includes(key)) {
        filters[key] = key === "age" ? Number(value) : value;
      }
    });

    // Exclude the current user from results
    if (currentUserId) {
      filters._id = { $ne: currentUserId };
    }

    // Fetch up to 20 profiles, omit sensitive fields, return plain JS objects
    const rawUsers = await User.find(filters)
      .limit(20)
      .select("-password -email -blockedUsers")
      .lean();

    const users = rawUsers.map((u) => {
      // Ensure arrays exist to avoid runtime errors
      const likes      = Array.isArray(u.likes) ? u.likes : [];
      const passes     = Array.isArray(u.passes) ? u.passes : [];
      const superLikes = Array.isArray(u.superLikes) ? u.superLikes : [];

      // Utility to normalize an image string into a URL
      const normalizeUrl = (img) => {
        if (typeof img !== 'string' || img.trim() === '') return null;
        if (img.startsWith("http")) {
          return img;
        }
        if (img.includes("/")) {
          return img.startsWith("/") ? img : `/${img}`;
        }
        return `/uploads/${img}`;
      };

      // Build a photos array of { url } objects
      let photos = [];
      if (Array.isArray(u.extraImages) && u.extraImages.length) {
        photos = u.extraImages
          .map(normalizeUrl)
          .filter(Boolean)
          .map((url) => ({ url }));
      } else if (u.profilePicture) {
        const url = normalizeUrl(u.profilePicture);
        if (url) photos.push({ url });
      }

      return {
        ...u,
        id: u._id.toString(),
        likes,
        passes,
        superLikes,
        photos,
      };
    });

    return res.json(users);
  } catch (err) {
    console.error("getDiscover error:", err);
    return res
      .status(500)
      .json({ error: "Server error fetching discover profiles" });
  }
};

exports.handleAction = async (req, res) => {
  try {
    const { userId: targetId, actionType } = req.params;
    const currentUserId = req.userId;

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.sendStatus(404);
    }

    // Ensure arrays exist before modification
    if (!Array.isArray(user.likes))      user.likes = [];
    if (!Array.isArray(user.passes))     user.passes = [];
    if (!Array.isArray(user.superLikes)) user.superLikes = [];

    // Record the chosen action
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
