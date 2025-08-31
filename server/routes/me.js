// --- REPLACE START: Consistent /api/me that returns isPremium, premium and entitlements.tier ---
import express from "express";

// Auth middleware (normalized import; supports default or named export)
import * as AuthenticateModule from "../middleware/authenticate.js";
const authenticate =
  AuthenticateModule.default ||
  AuthenticateModule.authenticate ||
  AuthenticateModule;

// User model (interop with CJS/ESM)
import * as UserModule from "../models/User.js";
const User = UserModule.default || UserModule;

const router = express.Router();

/**
 * GET /api/me
 * Returns a normalized profile for the authenticated user.
 * Ensures BOTH premium flags and entitlements are present and consistent.
 *
 * Response (example):
 * {
 *   "id": "68a2c806c6f024f3dc4ce394",
 *   "email": "user@example.com",
 *   "username": "alice",
 *   "isPremium": true,
 *   "premium": true,
 *   "entitlements": { "tier": "premium", "since": "...", "until": null, "features": {...}, "quotas": {...} },
 *   "stripeCustomerId": "cus_...",
 *   "subscriptionId": "sub_...",
 *   "visibility": { "isHidden": false, "hiddenUntil": null, "resumeOnLogin": true },
 *   "profilePicture": "/uploads/...",
 *   "photos": ["/uploads/a.jpg", "/uploads/b.jpg"],
 *   "name": "Alice", "age": 30, "gender": "female",
 *   "country": "FI", "region": "Uusimaa", "city": "Helsinki",
 *   "createdAt": "...", "updatedAt": "..."
 * }
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    const id =
      (req.userId && String(req.userId)) ||
      (req.user && (req.user.id || req.user.userId)) ||
      null;

    if (!id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Use full doc to keep schema virtuals + transform (safeTransform) from the model
    const doc = await User.findById(id).exec();
    if (!doc) {
      return res.status(404).json({ error: "User not found" });
    }

    // Apply model's safe transform
    const u = doc.toJSON ? doc.toJSON() : doc;

    // Normalize premium signals
    const ent = u.entitlements && typeof u.entitlements === "object" ? u.entitlements : {};
    const legacyFlag = !!u.premium;
    const newFlag = !!u.isPremium;
    const entTier = ent.tier === "premium";

    const isPremium = newFlag || legacyFlag || entTier;
    const tier = isPremium ? "premium" : "free";

    // Prepare consistent visibility
    const visObj = u.visibility && typeof u.visibility === "object" ? u.visibility : {};
    const visibility = {
      isHidden:
        u.isHidden === true ||
        visObj.isHidden === true ||
        false,
      hiddenUntil: u.hiddenUntil || visObj.hiddenUntil || null,
      resumeOnLogin:
        typeof visObj.resumeOnLogin === "boolean"
          ? visObj.resumeOnLogin
          : (typeof u.resumeOnLogin === "boolean" ? u.resumeOnLogin : true),
    };

    // Photos normalization (accepts photos or extraImages)
    const photos =
      Array.isArray(u.photos) ? u.photos :
      (Array.isArray(u.extraImages) ? u.extraImages : []);

    const payload = {
      id: String(u._id || u.id),
      email: u.email || null,
      username: u.username || null,

      // ✅ premium flags (both kept in sync)
      isPremium,
      premium: isPremium,

      // ✅ entitlements coerced
      entitlements: {
        tier,
        since: ent.since || null,
        until: ent.until || null,
        features: ent.features || undefined,
        quotas: ent.quotas || undefined,
      },

      // ✅ billing identifiers
      stripeCustomerId: u.stripeCustomerId || null,
      subscriptionId: u.subscriptionId || null,

      // ✅ visibility
      visibility,

      // Safe profile fields
      profilePicture: u.profilePicture || null,
      photos,
      name: u.name || null,
      age: u.age || null,
      gender: u.gender || null,

      // Location (support nested + legacy)
      country: (u.location && u.location.country) || u.country || null,
      region: (u.location && u.location.region) || u.region || null,
      city: (u.location && u.location.city) || u.city || null,

      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null,
    };

    return res.json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/me] error:", err?.message || err);
    return res.status(500).json({ error: "Unable to fetch current user" });
  }
});

export default router;
// --- REPLACE END ---
