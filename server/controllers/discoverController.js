// --- REPLACE START: Discover controller with robust filters + dealbreakers age & lifestyle fallback (no unnecessary shortening) ---
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
   NOTE: we intentionally DO NOT include 'mustHavePhoto' or 'nonSmokerOnly'
   in this whitelist, because they are toggles that translate into complex
   filter expressions (handled separately below).
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

/** Build request → Mongo filters with whitelist and field mapping (hidden handled separately) */
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
   Hidden exclusion logic
   ---------------------------------------------------------------------------
   We support multiple representations:
   - `hidden: true`
   - `visibility.isHidden: true`
   - `visibility.hiddenUntil: ISODate in the future`
   A profile is considered "visible" when:
   - hidden is missing or false
   - AND (visibility.isHidden missing or false)
   - AND (hiddenUntil missing OR <= now)
============================================================================= */
function hiddenExclusionClause(now = new Date()) {
  return {
    $or: [
      { hidden: { $exists: false } },
      { hidden: false },
      { 'visibility.isHidden': { $exists: false } },
      { 'visibility.isHidden': false },
      { 'visibility.hiddenUntil': { $exists: true, $lte: now } }, // expired scheduled hide
    ],
  };
}

/* =============================================================================
   Lifestyle filter builders (mustHavePhoto & nonSmokerOnly)
   ---------------------------------------------------------------------------
   These are applied either explicitly (via query) or as a fallback from
   the current user's dealbreakers, preserving "explicit beats fallback".
============================================================================= */
function buildMustHavePhotoClause() {
  return {
    $or: [
      { profilePicture: { $exists: true, $ne: null, $ne: '' } },
      { 'photos.0': { $exists: true } },
      { 'extraImages.0': { $exists: true } },
    ],
  };
}

function buildNonSmokerClause() {
  // Flexible: support either string field 'smoke' or boolean 'smoker'
  return {
    $or: [
      { smoker: { $exists: true, $ne: true } }, // smoker !== true  (false/undefined treated as pass)
      {
        smoke: {
          $in: [
            'no',
            'none',
            'never',
            'non-smoker',
            'non smoker',
            'nonsmoker',
            'sober',
            'clean',
            'nope',
            'no_smoke',
            'does not smoke',
          ],
        },
      },
      { smoke: { $exists: true, $eq: false } }, // sometimes stored as boolean false
    ],
  };
}

/* =============================================================================
   Utility: combine filters so that includeSelf bypasses lifestyle requirements
   ---------------------------------------------------------------------------
   - Self branch: respects hidden (unless includeHidden=1) and age, but IGNORES
     mustHavePhoto / nonSmokerOnly.
   - Others branch: applies all filters including lifestyle.
============================================================================= */
function buildCombinedFiltersForDiscover({
  query,
  currentUserId,
  includeSelfRequested,
  includeHidden,
  appliedMustHavePhoto,
  appliedNonSmokerOnly,
}) {
  // Base "others" branch: never include self here
  let others = buildFiltersFromQuery(query, currentUserId, { allowSelf: false });
  others = applyOptionalAgeFilter(others, query);

  const branchClauses = [];

  // Visibility clause (applied to both branches when includeHidden=0)
  const visClause = !includeHidden ? hiddenExclusionClause(new Date()) : null;

  // Lifestyle applied to OTHERS ONLY (explicit or fallback)
  const lifestyleAnd = [];
  if (appliedMustHavePhoto === true) lifestyleAnd.push(buildMustHavePhotoClause());
  if (appliedNonSmokerOnly === true) lifestyleAnd.push(buildNonSmokerClause());

  if (lifestyleAnd.length) {
    others = { $and: [others, ...lifestyleAnd] };
  }
  if (visClause) {
    others = { $and: [others, visClause] };
  }
  branchClauses.push(others);

  // Optional SELF branch (bypasses lifestyle, but still respects age & visibility)
  if (currentUserId && includeSelfRequested) {
    let selfBranch = { _id: currentUserId };
    // Respect age if client asked for it (includeSelf sanity tests send exact age)
    selfBranch = applyOptionalAgeFilter(selfBranch, query);
    if (visClause) {
      selfBranch = { $and: [selfBranch, visClause] };
    }
    // Put self branch first for clarity (debug readability)
    branchClauses.unshift(selfBranch);
  }

  // If self requested, OR(self, others). Otherwise just others.
  return branchClauses.length > 1 ? { $or: branchClauses } : branchClauses[0];
}

/* =============================================================================
   GET /api/discover
   ---------------------------------------------------------------------------
   Retrieves a list of user profiles based on filters and excludes the current
   user by default. When includeSelf=1, own profile is included even if it
   violates lifestyle dealbreakers, but still respects visibility (unless
   includeHidden=1) and explicit age range.
   Images are normalized to server-relative paths; client will absolutize with
   BACKEND_BASE_URL.
============================================================================= */
// --- REPLACE START: tighten JSON response + fix self-include guard + dealbreakers age & lifestyle fallback + meta ---
export async function getDiscover(req, res) {
  try {
    // Force JSON semantics & no cache (avoids HTML SPA fallbacks confusing fetch)
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Robust current user id detection (covers various auth middlewares)
    const currentUserId =
      req.userId ||
      req?.user?.userId ||
      req?.user?.id ||
      (req?.user?._id && String(req.user._id)) ||
      null;

    // Optional: read my current visibility for a one-line debug
    let meVis = undefined;
    try {
      if (currentUserId && User?.findById) {
        const meDoc = await User.findById(String(currentUserId))
          .select('hidden visibility.hiddenUntil visibility.isHidden')
          .lean();
        if (meDoc) {
          meVis = {
            hidden: !!meDoc.hidden,
            isHidden: !!(meDoc.visibility && meDoc.visibility.isHidden),
            hiddenUntil:
              (meDoc.visibility && meDoc.visibility.hiddenUntil) || undefined,
          };
        }
      }
    } catch { /* debug only */ }

    // Flags from query
    const includeSelfRequested = isTruthy(req.query.includeSelf);
    const includeHidden = isTruthy(req.query.includeHidden);

    // --- Dealbreakers fallback: age + lifestyle (only if missing in query) ---
    let appliedMinAge = undefined;
    let appliedMaxAge = undefined;
    let appliedMustHavePhoto = undefined;
    let appliedNonSmokerOnly = undefined;

    try {
      const explicitMin = Object.prototype.hasOwnProperty.call(req.query, 'minAge') && req.query.minAge !== '';
      const explicitMax = Object.prototype.hasOwnProperty.call(req.query, 'maxAge') && req.query.maxAge !== '';
      const explicitMHP = Object.prototype.hasOwnProperty.call(req.query, 'mustHavePhoto');
      const explicitNSO = Object.prototype.hasOwnProperty.call(req.query, 'nonSmokerOnly');

      if (currentUserId && User?.findById) {
        const mePrefs = await User.findById(String(currentUserId))
          .select('preferences.dealbreakers.ageMin preferences.dealbreakers.ageMax preferences.dealbreakers.mustHavePhoto preferences.dealbreakers.nonSmokerOnly')
          .lean();

        const dbMin = toNumberSafe(mePrefs?.preferences?.dealbreakers?.ageMin, undefined);
        const dbMax = toNumberSafe(mePrefs?.preferences?.dealbreakers?.ageMax, undefined);
        const dbMHP = !!mePrefs?.preferences?.dealbreakers?.mustHavePhoto;
        const dbNSO = !!mePrefs?.preferences?.dealbreakers?.nonSmokerOnly;

        if (!explicitMin && Number.isFinite(dbMin)) {
          req.query.minAge = String(dbMin);
          appliedMinAge = dbMin;
        } else if (explicitMin) {
          appliedMinAge = toNumberSafe(req.query.minAge, undefined);
        }

        if (!explicitMax && Number.isFinite(dbMax)) {
          req.query.maxAge = String(dbMax);
          appliedMaxAge = dbMax;
        } else if (explicitMax) {
          appliedMaxAge = toNumberSafe(req.query.maxAge, undefined);
        }

        if (explicitMHP) {
          appliedMustHavePhoto = isTruthy(req.query.mustHavePhoto);
        } else if (dbMHP) {
          appliedMustHavePhoto = true;
        }

        if (explicitNSO) {
          appliedNonSmokerOnly = isTruthy(req.query.nonSmokerOnly);
        } else if (dbNSO) {
          appliedNonSmokerOnly = true;
        }
      }
    } catch {
      // Silent fallback on any error
    }

    // Build COMBINED filters with self-branch bypassing lifestyle
    const filters = buildCombinedFiltersForDiscover({
      query: req.query,
      currentUserId,
      includeSelfRequested,
      includeHidden,
      appliedMustHavePhoto,
      appliedNonSmokerOnly,
    });

    // Build query
    const { limit, skip, sort } = buildPagingAndSort(req.query);

    let q = User.find(filters)
      .select('-password -passwordResetToken -passwordResetExpires -blockedUsers')
      .limit(limit)
      .skip(skip)
      .lean();

    if (sort) q = q.sort(sort);

    const rawUsers = await q;
// --- REPLACE END ---
// --- REPLACE START (continuation of getDiscover, Part 2/2) ---
    // Normalize result shape and image fields
    const users = rawUsers.map((u) => {
      // Compose photos: photos -> extraImages -> profilePicture
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

    // Build meta for client diagnostics
    const meta = {
      includeSelf: !!includeSelfRequested,
      includeHidden: !!includeHidden,
      appliedMinAge:
        appliedMinAge !== undefined ? appliedMinAge : toNumberSafe(req.query.minAge, undefined),
      appliedMaxAge:
        appliedMaxAge !== undefined ? appliedMaxAge : toNumberSafe(req.query.maxAge, undefined),
      appliedMustHavePhoto: appliedMustHavePhoto === true,
      appliedNonSmokerOnly: appliedNonSmokerOnly === true,
      page: toNumberSafe(req.query.page, 1) || 1,
      limit: toNumberSafe(req.query.limit, 100) || 100,
      sort: (typeof req.query.sort === 'string' && req.query.sort) || null,
    };

    // One-line server debug
    try {
      const hasSelf = !!users.find(u => String(u._id || u.id) === String(currentUserId));
      console.log(
        `[discover] user=${currentUserId || 'anon'} vis=${JSON.stringify(meVis || {})} ` +
        `qs.includeSelf=${!!includeSelfRequested} qs.includeHidden=${!!includeHidden} ` +
        `qs.minAge=${req.query.minAge ?? ''} qs.maxAge=${req.query.maxAge ?? ''} ` +
        `applied.mhp=${meta.appliedMustHavePhoto} applied.nso=${meta.appliedNonSmokerOnly} ` +
        `result.count=${users.length} hasSelf=${hasSelf}`
      );
    } catch { /* noop */ }

    // Respond with array for client (kept as { users } for compatibility) + meta
    return res.status(200).json({ users, meta });
  } catch (err) {
    console.error('getDiscover error:', err);
    // Ensure JSON even on error (prevents HTML fallback confusing the client)
    return res
      .status(500)
      .json({ error: 'Server error fetching discover profiles' });
  }
}
// --- REPLACE END ---

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

