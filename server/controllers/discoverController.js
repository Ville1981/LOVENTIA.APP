// --- REPLACE START: Discover controller with robust filters, optional age, includeSelf, pagination, and safe image URL normalization ---
'use strict';

/* =============================================================================
   CJS/ESM interop for User model (fix default import error across bundlers)
   ---------------------------------------------------------------------------
   We import the model in a way that works whether it exports default or named.
============================================================================= */
// --- REPLACE START: CJS/ESM interop for User model (fix default import error) ---
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;
// --- REPLACE END ---

/* =============================================================================
   Whitelist for query parameters
   ---------------------------------------------------------------------------
   Keep explicit and conservative. Top-level location fields are mapped
   to nested schema fields in the mapper below.
============================================================================= */
const allowedFilters = [
  'username',
  'gender',
  'orientation',
  'religion',
  'religionImportance',
  'education',
  'profession',
  'professionCategory',   // optional UI field
  'country',
  'region',
  'city',
  'children',
  'pets',
  'summary',
  'goals',                // legacy support (mapped to 'goal')
  'goal',                 // canonical schema field
  'lookingFor',
  'smoke',
  'drink',
  'drugs',
  'status',               // relationship status (if present in schema)
  'bodyType',             // if present in schema
  // --- REPLACE START: allow political ideology filters (UI + schema aligned) ---
  'politicalIdeology',
  // --- REPLACE END ---
];

/* =============================================================================
   Helpers
============================================================================= */
/** Parse number safely (accepts numeric strings), returns fallback if NaN/empty */
function toNumberSafe(v, fallback = undefined) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Return boolean-like truthiness for query toggles ('1', 'true', true) */
function isTruthy(v) {
  return v === true || v === 'true' || v === '1' || v === 1;
}

/** Lightweight case-insensitive regex builder for partial matches */
function ciLike(value) {
  try {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  } catch {
    return value;
  }
}

/** Normalize image url/paths to server-relative form (client will absolutize) */
function normalizeImagePath(img) {
  if (!img) return null;

  // Accept both string and { url } object
  const raw =
    typeof img === 'string'
      ? img
      : typeof img === 'object' && img.url
      ? img.url
      : null;

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

/** Normalize an array of mixed image entries (string or {url}) into {url}[] */
function normalizeImageArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p) => (typeof p === 'string' ? p : p?.url))
    .map(normalizeImagePath)
    .filter(Boolean)
    .map((url) => ({ url }));
}

/** Map request query to Mongo filters with whitelist and field mapping */
function buildFiltersFromQuery(query, currentUserId, { allowSelf }) {
  const filters = {};

  // Apply whitelist filters from query string
  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || !allowedFilters.includes(key)) return;

    // Map top-level location & goals→goal to schema fields
    if (key === 'city') {
      filters['location.city'] = value;
    } else if (key === 'region') {
      filters['location.region'] = value;
    } else if (key === 'country') {
      filters['location.country'] = value;
    } else if (key === 'goals' || key === 'goal') {
      // The schema uses singular 'goal'
      filters['goal'] = value;
    } else if (key === 'username' || key === 'summary' || key === 'profession') {
      // Allow partial case-insensitive search on a few text fields
      filters[key] = ciLike(value);
    } else {
      filters[key] = value;
    }
  });

  // Exclude current user unless explicitly included
  if (currentUserId && !allowSelf) {
    filters._id = { $ne: currentUserId };
  }

  return filters;
}

/** Build age filter only if minAge and/or maxAge are provided */
function applyOptionalAgeFilter(filters, query) {
  const hasMin = Object.prototype.hasOwnProperty.call(query, 'minAge');
  const hasMax = Object.prototype.hasOwnProperty.call(query, 'maxAge');

  if (!(hasMin || hasMax)) return filters;

  let minAge = toNumberSafe(query.minAge, undefined);
  let maxAge = toNumberSafe(query.maxAge, undefined);

  if (!Number.isFinite(minAge)) minAge = 18;
  if (!Number.isFinite(maxAge)) maxAge = 120;

  minAge = Math.max(18, Math.min(120, minAge));
  maxAge = Math.max(18, Math.min(120, maxAge));
  if (minAge > maxAge) {
    const t = minAge;
    minAge = maxAge;
    maxAge = t;
  }

  return { ...filters, age: { $gte: minAge, $lte: maxAge } };
}

/** Build pagination & sorting (backward compatible defaults) */
function buildPagingAndSort(query) {
  // Defaults chosen to be safe & backward compatible
  const page = Math.max(1, toNumberSafe(query.page, 1) || 1);
  const limit = Math.max(1, Math.min(100, toNumberSafe(query.limit, 100) || 100));

  // Optional sort by recent activity/updatedAt if requested
  let sort = undefined;
  if (query.sort === 'recent') {
    sort = { updatedAt: -1 };
  } else if (query.sort === 'ageAsc') {
    sort = { age: 1 };
  } else if (query.sort === 'ageDesc') {
    sort = { age: -1 };
  }

  const skip = (page - 1) * limit;
  return { page, limit, skip, sort };
}

/* =============================================================================
   GET /api/discover
   ---------------------------------------------------------------------------
   Retrieves a list of user profiles based on filters and excludes the current
   user (unless includeSelf=1). Age filter is OPTIONAL. Images are normalized
   to server-relative paths; client will absolutize with BACKEND_BASE_URL.
============================================================================= */
export async function getDiscover(req, res) {
  try {
    // Robust current user id detection (covers various auth middlewares)
    const currentUserId =
      req.userId ||
      req?.user?.userId ||
      req?.user?.id ||
      (req?.user?._id && String(req.user._id)) ||
      null;

    // includeSelf toggle for dev/testing
    const includeSelf = isTruthy(req.query.includeSelf);
    // Build filters from query
    let filters = buildFiltersFromQuery(req.query, currentUserId, { allowSelf: includeSelf });
    // Apply age filter only when explicitly provided
    filters = applyOptionalAgeFilter(filters, req.query);

    // Paging & optional sort (defaults remain backward-compatible)
    const { limit, skip, sort } = buildPagingAndSort(req.query);

    // Build query
    let q = User.find(filters)
      .select('-password -passwordResetToken -passwordResetExpires -blockedUsers')
      .limit(limit)
      .skip(skip)
      .lean();

    if (sort) q = q.sort(sort);

    const rawUsers = await q;

    // Normalize result shape and image fields
    const users = rawUsers.map((u) => {
      // Build photos array preference: photos -> extraImages -> profilePicture
      let photos = [];
      if (Array.isArray(u.photos) && u.photos.length) {
        photos = normalizeImageArray(u.photos);
      } else if (Array.isArray(u.extraImages) && u.extraImages.length) {
        photos = normalizeImageArray(u.extraImages);
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

    // Respond with array for client (kept as { users } for compatibility)
    return res.status(200).json({ users });
  } catch (err) {
    console.error('getDiscover error:', err);
    return res
      .status(500)
      .json({ error: 'Server error fetching discover profiles' });
  }
}
/* =============================================================================
   POST /api/discover/:userId/:actionType
   ---------------------------------------------------------------------------
   Records an action (pass, like, superlike) from the current user.
   Action arrays are initialized defensively and duplicates are prevented.
============================================================================= */
export async function handleAction(req, res) {
  try {
    const { userId: targetId, actionType } = req.params;

    // Robust current user id detection for actions
    const currentUserId =
      req.userId ||
      req?.user?.userId ||
      req?.user?.id ||
      (req?.user?._id && String(req.user._id)) ||
      null;

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
