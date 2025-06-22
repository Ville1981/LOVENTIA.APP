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
      // Build a photos array of { url } objects
      let photos = [];

      /** 
       * Utility to normalize a single img-string into a URL.
       * - jos alkaa http, lähetetään sellaisenaan
       * - jos stringissä on "/" ⇒ oletetaan, että se on jo polku “uploads/…”
       *   => varmistetaan vain, että siinä on alussa yksi "/"
       * - muuten katsotaan pelkkä tiedostonimi ⇒ prefixataan "/uploads/"
       */
      const normalizeUrl = (img) => {
        if (img.startsWith("http")) {
          return img;
        }
        if (img.includes("/")) {
          // jo muotoa "uploads/…" tai "/uploads/…"
          return img.startsWith("/") ? img : `/${img}`;
        }
        // pelkkä tiedostonimi
        return `/uploads/${img}`;
      };

      // 1) extraImages‐taulukosta
      if (Array.isArray(u.extraImages) && u.extraImages.length) {
        photos = u.extraImages
          .filter(Boolean)
          .map((img) => ({ url: normalizeUrl(img) }));
      }
      // 2) fallback: profilePicture‐kenttä
      else if (u.profilePicture) {
        photos = [{ url: normalizeUrl(u.profilePicture) }];
      }

      return {
        ...u,
        id: u._id.toString(),
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
