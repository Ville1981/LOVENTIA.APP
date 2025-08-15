// --- REPLACE START: profile service (getMe, updateProfile, matches, premium) ---
/**
 * Profile service
 * - Preserves original structure and behavior.
 * - Adds robust support for political ideology:
 *     * Accepts both `politicalIdeology` (client/UI) and `ideology` (schema).
 *     * Maps `politicalIdeology` -> `ideology` if needed.
 * - Keeps location mapping, numeric coercions, and array parsing.
 * - All comments are in English. No unnecessary shortening done.
 */

import * as UserModule from '../../models/User.js';
const User = UserModule.default || UserModule;

import toPublic from '../utils/toPublic.js';
import getUserId from '../utils/getUserId.js';

/**
 * Whitelist of fields accepted from the client.
 * NOTE:
 *  - We accept both `politicalIdeology` (client/UI) and `ideology` (schema) so either will work.
 *  - We do NOT remove any entries you already had; only additions where needed.
 */
const UPDATABLE_FIELDS = [
  // basic
  'name',
  'username',
  'bio',                 // maps to summary internally
  'summary',
  'age',
  'gender',
  'status',
  'orientation',         // allow orientation updates
  'ideology',            // schema key
  'politicalIdeology',   // client/UI key -> mapped to ideology

  // top-level location convenience (mapped to nested location.*)
  'city',
  'region',
  'country',

  // nested location object pass-through if client sends it
  'location',

  // profile/media
  'profilePicture',
  'bannerImage',

  // discover/preferences
  'preferredGender',
  'preferredMinAge',
  'preferredMaxAge',
  'preferredInterests',

  // lifestyle & profile extras
  'smoke',
  'drink',
  'drugs',
  'bodyType',
  'height',
  'heightUnit',
  'weight',
  'weightUnit',
  'education',
  'religion',
  'religionImportance',
  'children',
  'pets',
  'healthInfo',
  'activityLevel',
  'nutritionPreferences',
  'profession',
  'professionCategory',
  'lookingFor',
  'goal',

  // interests & tags
  'interests',

  // coordinates for nearby search (accept both styles)
  'lat',
  'lng',
  'latitude',
  'longitude',

  // custom location labels
  'customCity',
  'customRegion',
  'customCountry',
];

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export async function getMeService(req, res) {
  try {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json(toPublic(user));
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ error: 'Server error fetching profile' });
  }
}

export async function updateProfileService(req, res) {
  try {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body || {};
    const update = {};

    // Copy only allowed fields (keep behavior; do not shorten)
    for (const key of UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        update[key] = body[key];
      }
    }

    // Normalize fields without removing existing logic

    // 1) bio -> summary (model uses summary)
    if (Object.prototype.hasOwnProperty.call(update, 'bio') && !update.summary) {
      update.summary = update.bio;
      delete update.bio;
    }

    // 2) Support both politicalIdeology (client) and ideology (schema)
    if (Object.prototype.hasOwnProperty.call(update, 'politicalIdeology')) {
      if (!Object.prototype.hasOwnProperty.call(update, 'ideology')) {
        update.ideology = update.politicalIdeology;
      }
      delete update.politicalIdeology;
    }

    // 3) city/region/country to nested location.*
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

    // 4) coordinates: accept lat/lng or latitude/longitude
    const hasLat = Object.prototype.hasOwnProperty.call(update, 'lat');
    const hasLng = Object.prototype.hasOwnProperty.call(update, 'lng');
    const hasLatitude = Object.prototype.hasOwnProperty.call(update, 'latitude');
    const hasLongitude = Object.prototype.hasOwnProperty.call(update, 'longitude');

    if (hasLat) {
      const n = Number(update.lat);
      update.latitude = Number.isNaN(n) ? update.latitude : n;
      delete update.lat;
    }
    if (hasLng) {
      const n = Number(update.lng);
      update.longitude = Number.isNaN(n) ? update.longitude : n;
      delete update.lng;
    }
    if (hasLatitude) {
      const n = Number(update.latitude);
      update.latitude = Number.isNaN(n) ? undefined : n;
    }
    if (hasLongitude) {
      const n = Number(update.longitude);
      update.longitude = Number.isNaN(n) ? undefined : n;
    }

    // 5) type coercions / clamps
    if (typeof update.age !== 'undefined') {
      const n = Number(update.age);
      if (!Number.isNaN(n)) update.age = Math.min(120, Math.max(18, n));
    }
    if (typeof update.preferredMinAge !== 'undefined') {
      const n = Number(update.preferredMinAge);
      if (!Number.isNaN(n)) update.preferredMinAge = Math.max(18, n);
    }
    if (typeof update.preferredMaxAge !== 'undefined') {
      const n = Number(update.preferredMaxAge);
      if (!Number.isNaN(n)) update.preferredMaxAge = Math.min(120, n);
    }

    // Arrays that may arrive as JSON strings or comma-separated strings
    const maybeArrayFields = [
      'preferredInterests',
      'interests',
      'nutritionPreferences',
    ];
    for (const f of maybeArrayFields) {
      if (typeof update[f] === 'string') {
        const s = update[f].trim();
        if (s.startsWith('[')) {
          try { update[f] = JSON.parse(s); } catch {}
        } else if (s.length) {
          update[f] = s.split(',').map((x) => x.trim()).filter(Boolean);
        }
      }
    }

    const hasDirect = Object.keys(update).length > 0;
    const hasLoc = Object.keys(locationSet).length > 0;
    if (!hasDirect && !hasLoc) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const finalUpdate = { ...update, ...locationSet };

    const user = await User.findByIdAndUpdate(uid, finalUpdate, {
      new: true,
      runValidators: true,
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ message: 'Profile updated', user: toPublic(user) });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ error: 'Server error during profile update' });
  }
}

export async function upgradeToPremiumService(req, res) {
  try {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.isPremium = true;
    await user.save();
    return res.json({ message: 'Premium status activated' });
  } catch (err) {
    console.error('Premium upgrade error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during premium upgrade' });
  }
}

export async function getMatchesWithScoreService(req, res) {
  try {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const currentUser = await User.findById(uid);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const blockedByMe = (currentUser.blockedUsers || []).map(String);
    const interests = currentUser.preferredInterests || [];

    const others = await User.find({ _id: { $ne: currentUser._id } });

    const matches = others
      .filter((u) => {
        const blockedThem = (u.blockedUsers || []).map(String);
        return (
          !blockedByMe.includes(u._id.toString()) &&
          !blockedThem.includes(currentUser._id.toString())
        );
      })
      .map((u) => {
        let score = 0;

        if (
          currentUser.preferredGender === 'any' ||
          (u.gender &&
            u.gender.toLowerCase() ===
              String(currentUser.preferredGender || '').toLowerCase())
        ) {
          score += 20;
        }

        if (
          typeof u.age === 'number' &&
          typeof currentUser.preferredMinAge === 'number' &&
          typeof currentUser.preferredMaxAge === 'number' &&
          u.age >= currentUser.preferredMinAge &&
          u.age <= currentUser.preferredMaxAge
        ) {
          score += 20;
        }

        const common = (u.interests || []).filter((i) =>
          (interests || []).includes(i)
        );
        score += Math.min(common.length * 10, 60);

        return {
          id: u._id.toString(),
          username: u.username,
          email: u.email,
          age: u.age,
          gender: u.gender,
          profilePicture: u.profilePicture,
          isPremium: Boolean(u.isPremium),
          matchScore: score,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    return res.json(matches);
  } catch (err) {
    console.error('Match score error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during match search' });
  }
}
// --- REPLACE END ---
