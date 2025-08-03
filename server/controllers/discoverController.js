// server/controllers/discoverController.js

// --- REPLACE START: convert to ES modules, translate comments to English, preserve all logic ---
import User from '../models/User.js';

// Allowed query parameters whitelist
const allowedFilters = [
  'username',
  'gender',
  'orientation',
  'religion',
  'religionImportance',
  'education',
  'profession',
  'country',
  'region',
  'city',
  'children',
  'pets',
  'summary',
  'goals',     // legacy support
  'goal',      // legacy support
  'lookingFor',
  'smoke',     // new
  'drink',     // new
  'drugs',     // new
];

/**
 * GET /api/discover
 * Retrieves a list of user profiles based on filters and excludes the current user
 */
export async function getDiscover(req, res) {
  try {
    const currentUserId = req.userId;
    const filters = {};

    // Apply whitelist filters from query string
    Object.entries(req.query).forEach(([key, value]) => {
      if (value != null && value !== '' && allowedFilters.includes(key)) {
        filters[key] = value;
      }
    });

    // Age range: supports minAge & maxAge, defaults if missing
    const minAge = parseInt(req.query.minAge, 10) || 18;
    const maxAge = parseInt(req.query.maxAge, 10) || 99;
    filters.age = { $gte: minAge, $lte: maxAge };

    // Exclude current user
    if (currentUserId) {
      filters._id = { $ne: currentUserId };
    }

    // Fetch users from MongoDB, exclude sensitive fields
    const rawUsers = await User.find(filters)
      .limit(20)
      .select('-password -email -blockedUsers')
      .lean();

    const users = rawUsers.map((u) => {
      const likes = Array.isArray(u.likes) ? u.likes : [];
      const passes = Array.isArray(u.passes) ? u.passes : [];
      const superLikes = Array.isArray(u.superLikes) ? u.superLikes : [];

      const normalizeUrl = (img) => {
        if (typeof img !== 'string' || img.trim() === '') return null;
        if (img.startsWith('http')) return img;
        return img.startsWith('/') ? img : `/uploads/${img}`;
      };

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
    console.error('getDiscover error:', err);
    return res
      .status(500)
      .json({ error: 'Server error fetching discover profiles' });
  }
}

/**
 * POST /api/discover/:userId/:actionType
 * Records an action (pass, like, superlike) from the current user
 */
export async function handleAction(req, res) {
  try {
    const { userId: targetId, actionType } = req.params;
    const currentUserId = req.userId;

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.sendStatus(404);
    }

    // Initialize action arrays if undefined
    if (!Array.isArray(user.likes)) user.likes = [];
    if (!Array.isArray(user.passes)) user.passes = [];
    if (!Array.isArray(user.superLikes)) user.superLikes = [];

    // Record action without duplication
    switch (actionType) {
      case 'like':
        if (!user.likes.includes(targetId)) user.likes.push(targetId);
        break;
      case 'pass':
        if (!user.passes.includes(targetId)) user.passes.push(targetId);
        break;
      case 'superlike':
        if (!user.superLikes.includes(targetId)) user.superLikes.push(targetId);
        break;
      default:
        return res.status(400).json({ error: 'Unknown action type' });
    }

    await user.save();
    return res.sendStatus(204);
  } catch (err) {
    console.error('handleAction error:', err);
    return res
      .status(500)
      .json({ error: 'Server error recording action' });
  }
}
// --- REPLACE END ---
