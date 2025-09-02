// File: server/services/profileService.js

// --- REPLACE START: profile service (ensure politicalIdeology + location fields persist, normalize outbound user) ---
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

// Use the shared normalizer so responses are consistent across controllers/routes
import normalizeUserOut from '../utils/normalizeUserOut.js';

/**
 * Resolve authenticated user id from common places set by auth middleware.
 * (Local helper to avoid hard dependency on a separate util file.)
 */
function getUserId(req) {
  return (
    req?.user?.id ||
    req?.user?.userId ||
    req?.user?._id ||
    req?.userId ||
    req?.auth?.userId ||
    req?.auth?.id ||
    null
  );
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Treat placeholder-ish strings as empty (server-side safety net) */
function isPlaceholderString(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  return s === '' || s === 'select' || s === 'choose' || s === 'none' || s === 'n/a' || s === '-';
}

/** Coerce value into array; drop empties/placeholders */
function toArrayClean(v) {
  const arr = Array.isArray(v) ? v : (typeof v === 'string' ? [v] : []);
  return arr
    .map((x) => (typeof x === 'string' ? x.trim() : x))
    .filter((x) => x !== undefined && x !== null && x !== '' && !isPlaceholderString(String(x)));
}

/** Normalize optional numeric */
function toNumOrUndefined(v) {
  if (v === undefined || v === null || v === '' || isPlaceholderString(String(v))) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Explicit allowlist of fields that can be updated by the profile PUT/PATCH.
// Keep this list comprehensive to avoid Mongoose dropping fields or the API
// returning legacy/old shapes.
const UPDATABLE_FIELDS = [
  // Identity / bio
  'name',
  'username',
  'bio',                 // legacy alias -> summary
  'summary',
  'age',
  'gender',
  'status',
  'orientation',

  // IMPORTANT: persist the actual model field name
  'politicalIdeology',

  // Location (both convenience and nested allowed)
  'city',
  'region',
  'country',
  'location',            // nested object { city, region, country }

  // Custom display labels
  'customCity',
  'customRegion',
  'customCountry',

  // Coordinates (accept both styles)
  'lat',
  'lng',
  'latitude',
  'longitude',

  // Media (paths are normalized elsewhere; persisted here)
  'profilePicture',
  'bannerImage',

  // Lifestyle & health
  'smoke',
  'drink',
  'drugs',
  'bodyType',
  'height',
  'heightUnit',
  'weight',
  'weightUnit',
  'healthInfo',
  'activityLevel',
  'nutritionPreferences',

  // Education, religion, family
  'education',
  'religion',
  'religionImportance',
  'children',
  'pets',

  // Work / goals
  'profession',
  'professionCategory',
  'lookingFor',
  'goal',

  // Interests & discover preferences
  'interests',
  'preferredGender',
  'preferredMinAge',
  'preferredMaxAge',
  'preferredInterests',
];

// Accept legacy payloads that might still send `ideology`
const LEGACY_ACCEPTED_FIELDS = ['ideology'];

/* ──────────────────────────────────────────────────────────────────────────────
   READ (GET)
────────────────────────────────────────────────────────────────────────────── */
export async function getMeService(req, res) {
  try {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    // Be explicit in case the schema marks some fields select:false in the future
    const user = await User.findById(uid).select('+politicalIdeology');
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json(normalizeUserOut(user));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[profileService] getMe error:', err);
    return res.status(500).json({ error: 'Server error fetching profile' });
  }
}

export async function getUserByIdService(req, res) {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ error: 'User id required' });

    const user = await User.findById(id).select('+politicalIdeology');
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json(normalizeUserOut(user));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[profileService] getUserById error:', err);
    return res.status(500).json({ error: 'Server error fetching user' });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   WRITE (PUT/PATCH)
────────────────────────────────────────────────────────────────────────────── */
export async function updateProfileService(req, res) {
  try {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body || {};
    const update = {};

    // 1) Copy only allowed fields (modern set)
    for (const key of UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        update[key] = body[key];
      }
    }
    // 2) Copy legacy fields we normalize later
    for (const key of LEGACY_ACCEPTED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        update[key] = body[key];
      }
    }

    // --- Normalization (WRITE) ---

    // (A) ideology (legacy) -> politicalIdeology
    if (
      Object.prototype.hasOwnProperty.call(update, 'ideology') &&
      !Object.prototype.hasOwnProperty.call(update, 'politicalIdeology')
    ) {
      update.politicalIdeology = update.ideology;
    }
    delete update.ideology;

    // (B) bio -> summary (keep summary if provided)
    if (Object.prototype.hasOwnProperty.call(update, 'bio') && !update.summary) {
      update.summary = update.bio;
      delete update.bio;
    }

    // (C) city/region/country → nested location.*
    const locationSet = {};
    if (Object.prototype.hasOwnProperty.call(update, 'city')) {
      locationSet['location.city'] = update.city;
      delete update.city;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'region')) {
      locationSet['location.region'] = update.region;
      delete update.region;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'country')) {
      locationSet['location.country'] = update.country;
      delete update.country;
    }
    if (isPlainObject(update.location)) {
      if (Object.prototype.hasOwnProperty.call(update.location, 'city')) {
        locationSet['location.city'] = update.location.city;
      }
      if (Object.prototype.hasOwnProperty.call(update.location, 'region')) {
        locationSet['location.region'] = update.location.region;
      }
      if (Object.prototype.hasOwnProperty.call(update.location, 'country')) {
        locationSet['location.country'] = update.location.country;
      }
      delete update.location;
    }

    // (D) coordinates (accept both lat/lng and latitude/longitude)
    const hasLat = Object.prototype.hasOwnProperty.call(update, 'lat');
    const hasLng = Object.prototype.hasOwnProperty.call(update, 'lng');
    const hasLatitude = Object.prototype.hasOwnProperty.call(update, 'latitude');
    const hasLongitude = Object.prototype.hasOwnProperty.call(update, 'longitude');
    if (hasLat) {
      const n = Number(update.lat);
      if (!Number.isNaN(n)) update.latitude = n;
      delete update.lat;
    }
    if (hasLng) {
      const n = Number(update.lng);
      if (!Number.isNaN(n)) update.longitude = n;
      delete update.lng;
    }
    if (hasLatitude) {
      const n = Number(update.latitude);
      if (!Number.isNaN(n)) update.latitude = n;
    }
    if (hasLongitude) {
      const n = Number(update.longitude);
      if (!Number.isNaN(n)) update.longitude = n;
    }

    // (E) numeric clamps (age + preferred ranges)
    if (typeof update.age !== 'undefined') {
      const n = Number(update.age);
      if (!Number.isNaN(n)) update.age = Math.min(130, Math.max(0, n));
    }
    if (typeof update.preferredMinAge !== 'undefined') {
      const n = Number(update.preferredMinAge);
      if (!Number.isNaN(n)) update.preferredMinAge = Math.max(18, Math.min(120, n));
    }
    if (typeof update.preferredMaxAge !== 'undefined') {
      const n = Number(update.preferredMaxAge);
      if (!Number.isNaN(n)) update.preferredMaxAge = Math.max(18, Math.min(120, n));
    }

    // (F) Arrays that may arrive as JSON or comma-separated
    const maybeArrayFields = ['interests', 'preferredInterests', 'nutritionPreferences'];
    for (const f of maybeArrayFields) {
      if (typeof update[f] === 'string') {
        const s = update[f].trim();
        if (s.startsWith('[')) {
          try { update[f] = JSON.parse(s); } catch { /* leave as string if parse fails */ }
        } else if (s.length) {
          update[f] = s.split(',').map((x) => x.trim()).filter(Boolean);
        }
      }
      if (Array.isArray(update[f])) {
        update[f] = toArrayClean(update[f]);
      }
    }

    // (G) Trim strings and convert placeholders/empty strings to undefined (UNSET semantics)
    for (const [k, v] of Object.entries(update)) {
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (isPlaceholderString(trimmed) || trimmed === '') {
          update[k] = undefined; // will UNSET in $set stage below via $unset map
        } else {
          update[k] = trimmed;
        }
      }
    }

    // Guard: nothing to update
    const hasDirect = Object.keys(update).length > 0;
    const hasLoc = Object.keys(locationSet).length > 0;
    if (!hasDirect && !hasLoc) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    // Build final update using $set / $unset to support “clear field” intent
    const $set = {};
    const $unset = {};

    // Apply normalized location first
    for (const [k, v] of Object.entries(locationSet)) {
      if (v === undefined || v === null || isPlaceholderString(String(v)) || v === '') {
        $unset[k] = '';
      } else {
        $set[k] = v;
      }
    }

    // Then other fields
    for (const [k, v] of Object.entries(update)) {
      if (v === undefined || v === null || (typeof v === 'string' && v === '')) {
        // Arrays: clear to empty array (client expects []) – handled after findOneAndUpdate
        // Scalars: UNSET
        $unset[k] = '';
      } else {
        $set[k] = v;
      }
    }

    const updateDoc = {};
    if (Object.keys($set).length) updateDoc.$set = $set;
    if (Object.keys($unset).length) updateDoc.$unset = $unset;

    // Execute update
    let user = await User.findByIdAndUpdate(uid, updateDoc, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Post-fix: if some array fields were UNSET above, convert to [] for client consistency
    const arrayFields = ['interests', 'preferredInterests', 'nutritionPreferences'];
    for (const f of arrayFields) {
      if (!Array.isArray(user[f])) {
        user[f] = [];
      }
    }

    // ✅ Always return a normalized user for the FE (single source of truth)
    // IMPORTANT: keep shape consistent with controllers → return the user object directly
    return res.json(normalizeUserOut(user));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[profileService] updateProfile error:', err);
    return res.status(500).json({ error: 'Server error during profile update' });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   PREMIUM (kept minimal; mirrors earlier behavior)
────────────────────────────────────────────────────────────────────────────── */
export async function upgradeToPremiumService(req, res) {
  try {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isPremium = true;
    user.premium = true; // legacy mirror for older clients
    if (typeof user.startPremium === 'function') user.startPremium(); // if model method exists, prefer it
    await user.save();

    return res.json(normalizeUserOut(user));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[profileService] premium upgrade error:', err);
    return res.status(500).json({ error: 'Server error during premium upgrade' });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   MATCHES (unchanged high-level logic; not central to this task)
────────────────────────────────────────────────────────────────────────────── */
export async function getMatchesWithScoreService(req, res) {
  try {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const currentUser = await User.findById(uid);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const blockedByMe = (currentUser.blockedUsers || []).map(String);
    const interestsPref = currentUser.preferredInterests || [];

    const others = await User.find({ _id: { $ne: currentUser._id } });

    const matches = others
      .filter((u) => {
        const theirBlocks = (u.blockedUsers || []).map(String);
        return (
          !blockedByMe.includes(String(u._id)) &&
          !theirBlocks.includes(String(currentUser._id))
        );
      })
      .map((u) => {
        let score = 0;

        // Gender preference
        if (
          currentUser.preferredGender === 'any' ||
          (u.gender &&
            u.gender.toLowerCase() === String(currentUser.preferredGender || '').toLowerCase())
        ) {
          score += 20;
        }

        // Age range
        if (
          typeof u.age === 'number' &&
          typeof currentUser.preferredMinAge === 'number' &&
          typeof currentUser.preferredMaxAge === 'number' &&
          u.age >= currentUser.preferredMinAge &&
          u.age <= currentUser.preferredMaxAge
        ) {
          score += 20;
        }

        // Interest overlap
        const common = (u.interests || []).filter((i) => (interestsPref || []).includes(i));
        score += Math.min(common.length * 10, 60);

        return {
          id: String(u._id),
          username: u.username,
          email: u.email,
          age: u.age,
          gender: u.gender,
          profilePicture: u.profilePicture,
          isPremium: Boolean(u.isPremium || u.premium),
          matchScore: score,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    return res.json(matches);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[profileService] match score error:', err);
    return res.status(500).json({ error: 'Server error during match search' });
  }
}
// --- REPLACE END ---

