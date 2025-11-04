// PATH: server/src/routes/me.js

// --- REPLACE START: Consistent /api/me that delegates to authController.me when available ---
import express from "express";

// Auth middleware (ESM/CJS tolerant)
import * as AuthenticateModule from "../middleware/authenticate.js";
const authenticate =
  AuthenticateModule.default ||
  AuthenticateModule.authenticate ||
  AuthenticateModule;

// Try to use the same auth controller we just fixed for /api/auth/*
import * as AuthControllerNS from "../api/controllers/authController.js";
const authController =
  AuthControllerNS.default && typeof AuthControllerNS.default === "object"
    ? AuthControllerNS.default
    : AuthControllerNS;

// User model (interop with CJS/ESM) — kept as fallback
import * as UserModule from "../models/User.js";
const User = UserModule.default || UserModule;

const router = express.Router();

/**
 * Local helper: normalize user exactly like auth does.
 * This is only used if we cannot delegate to authController.me.
 */
function safeUserOutLocal(userDocOrLean) {
  if (!userDocOrLean) return null;
  const u =
    typeof userDocOrLean.toObject === "function"
      ? userDocOrLean.toObject()
      : { ...userDocOrLean };

  // Strip sensitive
  delete u.password;
  delete u.passwordResetToken;
  delete u.passwordResetExpires;

  // Ensure arrays
  if (!Array.isArray(u.extraImages)) {
    u.extraImages = u.extraImages ? [u.extraImages].filter(Boolean) : [];
  }
  if (!Array.isArray(u.photos)) {
    u.photos = Array.isArray(u.extraImages) ? [...u.extraImages] : [];
  }

  // Billing: prefer nested.billing.stripeCustomerId, but mirror to top level too
  if (!u.billing || typeof u.billing !== "object") {
    u.billing = {};
  }
  const nestedCid = u.billing.stripeCustomerId || null;
  const topCid = u.stripeCustomerId || null;
  const effectiveCid = nestedCid || topCid || null;
  u.billing.stripeCustomerId = effectiveCid;
  u.stripeCustomerId = effectiveCid;

  // Premium flags as booleans
  u.isPremium = !!u.isPremium;
  u.premium = !!u.premium;

  return u;
}

/**
 * GET /api/me
 *
 * Tärkeä idea:
 * - Jos authController.me on olemassa (ja se on just se, jonka päivitimme),
 *   käytämme SITÄ, jotta /api/me ja /api/auth/me palauttavat samaa muotoa.
 * - Jos sitä ei ole (tai se heittää virheen), pudotaan varmaan fallbackiin,
 *   joka hakee User.findById ja normalisoi.
 */
router.get("/me", authenticate, async (req, res, next) => {
  // 1) if the controller has me, just delegate
  if (authController && typeof authController.me === "function") {
    // Se käyttää samaa normalisointia kuin /api/auth/me → hyvä
    return authController.me(req, res, next);
  }

  // 2) fallback — do it ourselves (shape pidetään mahdollisimman samana)
  try {
    const id =
      (req.userId && String(req.userId)) ||
      (req.user && (req.user.id || req.user.userId)) ||
      null;

    if (!id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const doc = await User.findById(id).exec();
    if (!doc) {
      return res.status(404).json({ error: "User not found" });
    }

    const u = safeUserOutLocal(doc);

    // Build consistent entitlements block (do NOT derive premium from here)
    const ent =
      u.entitlements && typeof u.entitlements === "object" ? u.entitlements : {};
    const isPremium = !!u.isPremium;
    const tier = isPremium ? "premium" : "free";

    // Visibility normalize
    const visObj =
      u.visibility && typeof u.visibility === "object" ? u.visibility : {};
    const visibility = {
      isHidden:
        u.isHidden === true ||
        visObj.isHidden === true ||
        false,
      hiddenUntil: u.hiddenUntil || visObj.hiddenUntil || null,
      resumeOnLogin:
        typeof visObj.resumeOnLogin === "boolean"
          ? visObj.resumeOnLogin
          : typeof u.resumeOnLogin === "boolean"
          ? u.resumeOnLogin
          : true,
    };

    // Photos normalize
    const photos =
      Array.isArray(u.photos) && u.photos.length > 0
        ? u.photos
        : Array.isArray(u.extraImages)
        ? u.extraImages
        : [];

    const payload = {
      id: String(u._id || u.id),
      email: u.email || null,
      username: u.username || null,

      // premium flags (mirror)
      isPremium,
      premium: isPremium,

      entitlements: {
        tier,
        since: ent.since || null,
        until: ent.until || null,
        features: ent.features || undefined,
        quotas: ent.quotas || undefined,
      },

      stripeCustomerId: u.stripeCustomerId || null,
      subscriptionId: u.subscriptionId || null,

      visibility,

      profilePicture: u.profilePicture || null,
      photos,

      name: u.name || null,
      age: u.age || null,
      gender: u.gender || null,

      country: (u.location && u.location.country) || u.country || null,
      region: (u.location && u.location.region) || u.region || null,
      city: (u.location && u.location.city) || u.city || null,

      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null,
    };

    return res.json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/me] fallback error:", err?.message || err);
    return res.status(500).json({ error: "Unable to fetch current user" });
  }
});

export default router;
// --- REPLACE END ---

