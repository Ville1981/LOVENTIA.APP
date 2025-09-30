// PATH: server/src/routes/search.js

// --- REPLACE START: search route with DB-backed premium detection (keeps original structure) ---
'use strict';

// ESM imports
import express from "express";
import mongoose from "mongoose";
const router = express.Router();

import User from "../models/User.js";
import authenticate from "../middleware/authenticate.js";

/* -------------------------------------------------------------------------- */
/* Helpers: resolve current user & premium                                     */
/* -------------------------------------------------------------------------- */

/**
 * Resolve current user document:
 * - Prefer hydrated req.user if it looks like a Mongoose doc (.save exists)
 * - Else fetch by id (supports typical shapes produced by auth middleware)
 * - As a last dev/test fallback, accept Bearer <ObjectId>
 */
async function resolveCurrentUser(req) {
  try {
    // Hydrated doc?
    if (req?.user && typeof req.user.save === "function") {
      return req.user;
    }

    // Extract id from several common shapes
    const uid =
      req?.user?._id ||
      req?.user?.id ||
      req?.user?.userId ||
      req?.userId ||
      null;

    if (uid) {
      const id = String(uid);
      if (mongoose.isValidObjectId(id)) {
        const doc = await User.findById(id).lean(false).exec();
        if (doc) return doc;
      }
    }

    // Dev/test fallback: Authorization: Bearer <ObjectId>
    const auth = String(req.headers?.authorization || "");
    if (auth.startsWith("Bearer ")) {
      const token = auth.slice(7).trim();
      if (mongoose.isValidObjectId(token)) {
        const doc = await User.findById(token).lean(false).exec();
        if (doc) return doc;
      }
    }
  } catch {
    // ignore and return null
  }
  return null;
}

/**
 * Determine premium entitlement from a full User document.
 * Accepts legacy flags, plan names, or entitlements.features.
 */
function isPremiumUser(user) {
  if (!user) return false;
  if (user.isPremium === true || user.premium === true) return true;

  const feat = user?.entitlements?.features;
  if (feat && (feat.dealbreakers === true || feat.unlimitedRewinds === true)) {
    return true;
  }

  if (user.plan && /premium|pro|plus/i.test(String(user.plan))) return true;
  return false;
}

/* -------------------------------------------------------------------------- */
/* Route                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Search / Discover route
 * - Basic filters (gender, age range, location) available to all users
 * - Dealbreakers (strict filters) available only for Premium users
 *
 * Endpoint: POST /api/search
 * Body: {
 *   gender, minAge, maxAge,
 *   location?: { country, region, city } | (top-level country/region/city fallback),
 *   dealbreakers?: { mustHavePhoto, nonSmokerOnly, noDrugs, ageMin, ageMax }
 * }
 */
router.post("/", authenticate, async (req, res) => {
  try {
    // Resolve current user from DB to read premium flags
    const currentUser = await resolveCurrentUser(req);
    const premium = isPremiumUser(currentUser);

    const { gender, minAge, maxAge, location, dealbreakers } = req.body || {};
    const q = { isDeleted: { $ne: true } }; // exclude soft-deleted users

    // Base filters (available to everyone)
    if (gender && gender !== "any") q.gender = gender;
    if (minAge || maxAge) {
      q.age = {};
      if (minAge) q.age.$gte = Number(minAge);
      if (maxAge) q.age.$lte = Number(maxAge);
    }

    // Location filtering (accept both nested location and top-level fallbacks)
    const locObj = (location && typeof location === "object") ? location : {};
    const country = locObj.country ?? req.body?.country;
    const region  = locObj.region  ?? req.body?.region;
    const city    = locObj.city    ?? req.body?.city;

    if (country) q["location.country"] = country;
    if (region)  q["location.region"]  = region;
    if (city)    q["location.city"]    = city;

    // Premium-only dealbreakers
    if (premium) {
      if (dealbreakers && typeof dealbreakers === "object") {
        // Require a visible photo
        if (dealbreakers.mustHavePhoto) {
          q.$or = q.$or || [];
          q.$or.push(
            { profilePicture: { $exists: true, $ne: null } },
            { "photos.0": { $exists: true } }
          );
        }
        // Non-smoker only
        if (dealbreakers.nonSmokerOnly) {
          q.smoke = { $in: [null, "", "no", "never"] };
        }
        // No drugs
        if (dealbreakers.noDrugs) {
          q.drugs = { $in: [null, "", "no", "never"] };
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
      console.log(`[search] Ignoring dealbreakers for non-premium user=${currentUser?._id || req.user?.id || "n/a"}`);
    }

    // Keep projection minimal to avoid leaking sensitive fields
    const projection = "-password -emailVerificationToken -resetPasswordToken -refreshTokens -__v";

    // Limit hard-capped to avoid huge responses (keeps original behavior close with 50)
    const results = await User.find(q).select(projection).limit(50).exec();

    return res.json({
      ok: true,
      count: results.length,
      // Informative note only for non-premium when they attempted dealbreakers
      note: (!premium && dealbreakers) ? "Dealbreakers are available for Premium users only." : undefined,
      results,
    });
  } catch (err) {
    console.error("[search] Error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

// ESM default export (keep CJS fallback for safety)
export default router;
try { module.exports = router; } catch {}
// --- REPLACE END ---
