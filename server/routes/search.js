// File: server/routes/search.js
// --- REPLACE START: search route with premium-only dealbreakers (keeps original structure) ---
'use strict';

const express = require('express');
const router = express.Router();
const User = require('../models/User.js');

// Auth middleware
const authenticate = require('../middleware/authenticate.js');

/**
 * Search / Discover route
 * - Basic filters (gender, age range, location) available to all users
 * - Dealbreakers (strict filters) available only for Premium users
 *
 * Endpoint: POST /api/search
 * Body: {
 *   gender, minAge, maxAge,
 *   location: { country, region, city },
 *   dealbreakers?: { mustHavePhoto, nonSmokerOnly, noDrugs, ageMin, ageMax }
 * }
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { gender, minAge, maxAge, location, dealbreakers } = req.body || {};
    const q = { isDeleted: { $ne: true } }; // keep soft-deleted users out

    // Base filters (available to everyone)
    if (gender && gender !== 'any') q.gender = gender;
    if (minAge || maxAge) {
      q.age = {};
      if (minAge) q.age.$gte = Number(minAge);
      if (maxAge) q.age.$lte = Number(maxAge);
    }

    // Location filtering (basic exact-match example)
    if (location && typeof location === 'object') {
      const { country, region, city } = location;
      if (country) q['location.country'] = country;
      if (region) q['location.region'] = region;
      if (city) q['location.city'] = city;
    }

    // Premium-only dealbreakers
    const isPremium =
      req.user?.isPremium === true ||
      (Array.isArray(req.user?.features) && req.user.features.includes('dealbreakers')) ||
      (req.user?.plan && /premium|pro|plus/i.test(String(req.user.plan)));

    if (isPremium) {
      if (dealbreakers && typeof dealbreakers === 'object') {
        // Require a visible photo
        if (dealbreakers.mustHavePhoto) {
          q.$or = q.$or || [];
          q.$or.push(
            { profilePicture: { $exists: true, $ne: null } },
            { 'photos.0': { $exists: true } }
          );
        }
        // Non-smoker only
        if (dealbreakers.nonSmokerOnly) {
          q.smoke = { $in: [null, '', 'no', 'never'] };
        }
        // No drugs
        if (dealbreakers.noDrugs) {
          q.drugs = { $in: [null, '', 'no', 'never'] };
        }
        // Stricter age overrides
        if (dealbreakers.ageMin || dealbreakers.ageMax) {
          q.age = q.age || {};
          if (dealbreakers.ageMin) q.age.$gte = Number(dealbreakers.ageMin);
          if (dealbreakers.ageMax) q.age.$lte = Number(dealbreakers.ageMax);
        }
      }
    } else if (dealbreakers) {
      // Non-premium users cannot apply dealbreakers; ignore them silently and log once
      console.log(`[search] Ignoring dealbreakers for non-premium user=${req.user?.id || 'n/a'}`);
    }

    // Keep projection minimal to avoid leaking sensitive fields
    const projection = '-password -emailVerificationToken -resetPasswordToken -refreshTokens -__v';

    // Limit hard-capped to avoid huge responses (keeps original behavior close with 50)
    const results = await User.find(q).select(projection).limit(50).exec();

    return res.json({
      ok: true,
      count: results.length,
      // Informative note for clients (useful CTA trigger)
      note: !isPremium && dealbreakers ? 'Dealbreakers are available for Premium users only.' : undefined,
      results,
    });
  } catch (err) {
    console.error('[search] Error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
// --- REPLACE END ---
