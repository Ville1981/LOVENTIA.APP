// --- REPLACE START: Discover controller with robust filters, optional age, includeSelf, and safe image URL normalization ---
'use strict';

// --- REPLACE START: CJS/ESM interop for User model (fix default import error) ---
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;
// --- REPLACE END ---

/**
 * Allowed query parameters whitelist (kept explicit for safety)
 * NOTE: location.* fields are mapped below from top-level country/region/city
 */
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
  'goals',     // legacy support (mapped to 'goal')
  'goal',      // canonical schema field
  'lookingFor',
  'smoke',
  'drink',
  'drugs',
  'politicalIdeology', // ADDED: filter by political ideology
];

/** Helper: parse number safely (accepts numeric strings), returns fallback if NaN/empty */
function toNumberSafe(v, fallback = undefined) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Helper: normalize image url/paths to server-relative form (client will prefix BACKEND_BASE_URL) */
function normalizeImagePath(img) {
  if (!img) return null;

  // Accept both string and { url } object
  const raw = typeof img === 'string' ? img : (typeof img === 'object' && img.url) ? img.url : null;
  if (!raw || typeof raw !== 'string') return null;

  // Trim & convert Windows backslashes to forward slashes
  let s = raw.trim().replace(/\\/g, '/');
  if (s === '') return null;

  // Already absolute http(s)
  if (/^https?:\/\//i.test(s)) return s;

  // Remove leading slashes temporarily to simplify handling
  s = s.replace(/^\/+/, '');

  // If path starts with uploads/ (or /uploads/ after the strip), ensure single '/uploads/<rest>'
  if (/^uploads\/?/i.test(s)) {
    // Avoid double 'uploads/uploads'
    s = s.replace(/^uploads\/uploads\//i, 'uploads/');
    return `/${s}`;
  }

  // If it starts with known client asset roots (assets/static), keep single leading slash
  if (/^(assets|static)\//i.test(s)) {
    return `/${s}`;
  }

  // Otherwise treat as bare filename → place under uploads
  return `/uploads/${s}`;
}

/**
 * GET /api/discover
 * Retrieves a list of user profiles based on filters and excludes the current user (unless includeSelf=1).
 * Age filter is OPTIONAL: only applied if minAge and/or maxAge are provided.
 * Images are normalized to server-relative paths; client will absolutize with BACKEND_BASE_URL.
 */
export async function getDiscover(req, res) {
  try {
    // --- REPLACE START: robust current user id detection ---
    const currentUserId =
      req.userId ||
      req?.user?.userId ||
      req?.user?.id ||
      (req?.user?._id && String(req.user._id)) ||
      null;
    // --- REPLACE END ---

    // Build filters strictly from whitelist
    const filters = {};

    // Apply whitelist filters from query string
    Object.entries(req.query).forEach(([key, value]) => {
      if (value != null && value !== '' && allowedFilters.includes(key)) {
        // --- REPLACE START: map top-level location & goals→goal to schema fields ---
        if (key === 'city') {
          filters['location.city'] = value;
        } else if (key === 'region') {
          filters['location.region'] = value;
        } else if (key === 'country') {
          filters['location.country'] = value;
        } else if (key === 'goals' || key === 'goal') {
          // The schema uses singular 'goal'
          filters['goal'] = value;
        } else {
          filters[key] = value;
        }
        // --- REPLACE END ---
      }
    });

    // --- REPLACE START: age filter is OPTIONAL unless explicitly provided ---
    // Previously age might have been enforced too strictly, hiding profiles with string/empty ages.
    // Now we only add age constraints when minAge and/or maxAge exist in the query.
    const hasMin = Object.prototype.hasOwnProperty.call(req.query, 'minAge');
    const hasMax = Object.prototype.hasOwnProperty.call(req.query, 'maxAge');

    if (hasMin || hasMax) {
      let minAge = toNumberSafe(req.query.minAge, undefined);
      let maxAge = toNumberSafe(req.query.maxAge, undefined);

      // Apply sane defaults if one side missing/NaN
      if (!Number.isFinite(minAge)) minAge = 18;
      if (!Number.isFinite(maxAge)) maxAge = 120;

      // Clamp and ensure ordering
      minAge = Math.max(18, Math.min(120, minAge));
      maxAge = Math.max(18, Math.min(120, maxAge));
      if (minAge > maxAge) {
        const t = minAge; minAge = maxAge; maxAge = t;
      }

      filters.age = { $gte: minAge, $lte: maxAge };
    }
    // --- REPLACE END ---

    // --- REPLACE START: allow including self for dev testing via ?includeSelf=1 ---
    const includeSelf =
      req.query.includeSelf === '1' ||
      req.query.includeSelf === 'true' ||
      req.query.includeSelf === true;

    if (currentUserId && !includeSelf) {
      filters._id = { $ne: currentUserId };
    }
    // --- REPLACE END ---

    // Fetch users (exclude sensitive fields). Keep limit reasonable for UI.
    const rawUsers = await User.find(filters)
      .select('-password -passwordResetToken -passwordResetExpires -blockedUsers')
      .limit(100)
      .lean();

    // Normalize result shape and image fields
    const users = rawUsers.map((u) => {
      // Build photos array preference: photos -> extraImages -> profilePicture
      let photos = [];
      if (Array.isArray(u.photos) && u.photos.length) {
        photos = u.photos
          .map((p) => (typeof p === 'string' ? p : p?.url))
          .map(normalizeImagePath)
          .filter(Boolean)
          .map((url) => ({ url }));
      } else if (Array.isArray(u.extraImages) && u.extraImages.length) {
        photos = u.extraImages
          .map((p) => (typeof p === 'string' ? p : p?.url))
          .map(normalizeImagePath)
          .filter(Boolean)
          .map((url) => ({ url }));
      } else if (u.profilePicture) {
        const url = normalizeImagePath(u.profilePicture);
        if (url) photos.push({ url });
      }

      // Basic numeric age cast (tolerate string/undefined in DB)
      const age = toNumberSafe(u.age, undefined);

      return {
        ...u,
        id: u._id?.toString?.() || String(u._id),
        age,
        photos,
        profilePicture: photos?.[0]?.url || normalizeImagePath(u.profilePicture) || null,
      };
    });

    // Respond with object { users } (client expects response.body.users)
    return res.status(200).json({ users });
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

    // --- REPLACE START: robust current user id detection for actions ---
    const currentUserId =
      req.userId ||
      req?.user?.userId ||
      req?.user?.id ||
      (req?.user?._id && String(req.user._id)) ||
      null;
    // --- REPLACE END ---

    if (!currentUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!targetId) {
      return res.status(400).json({ error: 'Missing target user id' });
    }
    if (currentUserId === String(targetId)) {
      return res.status(400).json({ error: 'Cannot act on self' });
    }

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
