// PATH: server/src/routes/search.js

// --- REPLACE START: search route with DB-backed premium + stored dealbreakers support ---
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
 * Accepts legacy flags, entitlements tier, or entitlements.features.
 */
function isPremiumUser(user) {
  if (!user) return false;

  // Legacy hard flags
  if (user.isPremium === true || user.premium === true) {
    return true;
  }

  const ent = user.entitlements || {};
  const feat = ent.features || {};

  // Entitlements-tier based premium
  if (ent.tier === "premium") {
    return true;
  }

  // Explicit feature flags that imply premium
  if (
    feat.dealbreakers === true ||
    feat.unlimitedRewinds === true ||
    feat.unlimitedLikes === true ||
    feat.noAds === true
  ) {
    return true;
  }

  // Legacy plan naming (defensive)
  if (user.plan && /premium|pro|plus/i.test(String(user.plan))) {
    return true;
  }

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
 *   dealbreakers?: {
 *     mustHavePhoto?: boolean,
 *     nonSmokerOnly?: boolean,
 *     noDrugs?: boolean,
 *     ageMin?: number,
 *     ageMax?: number
 *   }
 * }
 *
 * NOTE:
 *   - If the request does not include dealbreakers, we fall back to the user's
 *     stored preferences.preferences.dealbreakers (for Premium users).
 *   - For Free users, any provided dealbreakers are ignored, but we return an
 *     informative note in the response.
 */
router.post("/", authenticate, async (req, res) => {
  try {
    // Resolve current user from DB to read premium flags
    const currentUser = await resolveCurrentUser(req);
    const premium = isPremiumUser(currentUser);

    const body = req.body || {};
    const { gender, minAge, maxAge, location } = body;

    // Dealbreakers from request body (if any)
    const requestDealbreakers =
      body.dealbreakers && typeof body.dealbreakers === "object"
        ? body.dealbreakers
        : null;

    // Dealbreakers from stored preferences (if any)
    const storedDealbreakers =
      currentUser &&
      currentUser.preferences &&
      typeof currentUser.preferences.dealbreakers === "object"
        ? currentUser.preferences.dealbreakers
        : null;

    // Effective dealbreakers for Premium:
    // - If request provided some, they override stored ones field-by-field
    // - Otherwise fall back to stored preferences
    let effectiveDealbreakers = null;
    if (premium) {
      if (requestDealbreakers && storedDealbreakers) {
        effectiveDealbreakers = {
          ...storedDealbreakers,
          ...requestDealbreakers,
        };
      } else {
        effectiveDealbreakers = requestDealbreakers || storedDealbreakers;
      }
    }

    const q = { isDeleted: { $ne: true } }; // exclude soft-deleted users

    // Exclude current user from results if we know who they are
    if (currentUser && currentUser._id) {
      q._id = { $ne: currentUser._id };
    }

    // Base filters (available to everyone)
    if (gender && gender !== "any") q.gender = gender;
    if (minAge || maxAge) {
      q.age = {};
      if (minAge) q.age.$gte = Number(minAge);
      if (maxAge) q.age.$lte = Number(maxAge);
    }

    // Location filtering (accept both nested location and top-level fallbacks)
    const locObj = location && typeof location === "object" ? location : {};
    const country = locObj.country ?? body.country;
    const region = locObj.region ?? body.region;
    const city = locObj.city ?? body.city;

    if (country) q["location.country"] = country;
    if (region) q["location.region"] = region;
    if (city) q["location.city"] = city;

    // -----------------------------------------------------------------------
    // Premium-only dealbreakers
    // -----------------------------------------------------------------------
    if (premium && effectiveDealbreakers && typeof effectiveDealbreakers === "object") {
      const db = effectiveDealbreakers;

      // Require a visible photo
      if (db.mustHavePhoto) {
        q.$or = q.$or || [];
        q.$or.push(
          { profilePicture: { $exists: true, $ne: null } },
          { "photos.0": { $exists: true } }
        );
      }

      // Non-smoker only
      if (db.nonSmokerOnly) {
        q.smoke = { $in: [null, "", "no", "never"] };
      }

      // No drugs
      if (db.noDrugs) {
        q.drugs = { $in: [null, "", "no", "never"] };
      }

      // Stricter age overrides (if provided)
      if (db.ageMin || db.ageMax) {
        q.age = q.age || {};
        if (db.ageMin) q.age.$gte = Number(db.ageMin);
        if (db.ageMax) q.age.$lte = Number(db.ageMax);
      }

      // NOTE: distanceKm / petsOk / religion / education:
      // These are defined in dealbreakers routes & schema, but their
      // geo/matching logic is handled elsewhere (e.g. /users/nearby).
      // We intentionally do not guess an implementation here to keep
      // behavior stable.
    } else if (!premium && (requestDealbreakers || storedDealbreakers)) {
      // Non-premium users cannot apply dealbreakers; ignore them silently
      // but log once for debugging.
      const uid =
        currentUser?._id ||
        req.user?._id ||
        req.user?.id ||
        req.user?.userId ||
        req.userId ||
        "n/a";
      console.log(
        `[search] Ignoring dealbreakers for non-premium user=${uid}`
      );
    }

    // Keep projection minimal to avoid leaking sensitive fields
    const projection =
      "-password -emailVerificationToken -resetPasswordToken -refreshTokens -__v";

    // Limit hard-capped to avoid huge responses (keeps original behavior close with 50)
    const results = await User.find(q).select(projection).limit(50).exec();

    return res.json({
      ok: true,
      count: results.length,
      // Informative note only for non-premium when they attempted custom dealbreakers
      note:
        !premium && requestDealbreakers
          ? "Dealbreakers are available for Premium users only."
          : undefined,
      results,
    });
  } catch (err) {
    console.error("[search] Error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

// ESM default export (keep CJS fallback for safety)
export default router;
try {
  // eslint-disable-next-line no-undef
  module.exports = router;
} catch {
  // ignore if module.exports is not available (pure ESM runtime)
}
// --- REPLACE END ---


