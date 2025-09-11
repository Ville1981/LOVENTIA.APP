// File: server/controllers/searchController.js
// --- REPLACE START: new searchController with premium-only dealbreakers ---
'use strict';

const User = require('../models/User.js');

/**
 * Handles user search with premium-only dealbreakers.
 */
async function searchUsers(req, res) {
  try {
    const { gender, minAge, maxAge, location, dealbreakers } = req.body || {};
    const q = {};

    // Always apply base filters if present
    if (gender && gender !== 'any') q.gender = gender;
    if (minAge || maxAge) {
      q.age = {};
      if (minAge) q.age.$gte = Number(minAge);
      if (maxAge) q.age.$lte = Number(maxAge);
    }

    // Location filtering (basic)
    if (location && typeof location === 'object') {
      const { country, region, city } = location;
      if (country) q['location.country'] = country;
      if (region) q['location.region'] = region;
      if (city) q['location.city'] = city;
    }

    // Premium-only dealbreakers
    if (req.user?.isPremium) {
      if (dealbreakers && typeof dealbreakers === 'object') {
        if (dealbreakers.mustHavePhoto) {
          q.profilePicture = { $exists: true, $ne: null };
        }
        if (dealbreakers.nonSmokerOnly) {
          q.smoke = { $in: [null, '', 'no'] };
        }
        if (dealbreakers.noDrugs) {
          q.drugs = { $in: [null, '', 'no'] };
        }
        if (dealbreakers.ageMin || dealbreakers.ageMax) {
          q.age = q.age || {};
          if (dealbreakers.ageMin) q.age.$gte = Number(dealbreakers.ageMin);
          if (dealbreakers.ageMax) q.age.$lte = Number(dealbreakers.ageMax);
        }
      }
    } else if (dealbreakers) {
      console.log(
        `[searchController] Ignoring dealbreakers for non-premium user=${req.user?.id}`
      );
    }

    const results = await User.find(q).select('-password').limit(50).exec();
    return res.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error('[searchController] Error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
}

module.exports = { searchUsers };
// --- REPLACE END ---
