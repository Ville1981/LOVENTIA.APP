// --- REPLACE START: migrate file to ESM and unify output normalizer across /me, /profile & PUT /profile ---
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import pathFs from "path";
import fs from "fs";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";

// Model (ESM/CJS interop)
import * as UserModule from "../models/User.js";
const User = UserModule.default || UserModule;

// ✅ Use the single shared normalizer — do NOT re-implement
import normalizeUserOut, {
  normalizeUsersOut,
} from "../utils/normalizeUserOut.js";

// Load controller (supports both default and named). We keep these for
// existing flows (auth, matches, premium, photo helpers) but ensure that
// the profile GET/PUT routes below always pass their result through
// normalizeUserOut so FE sees a complete, consistent shape.
import * as UserControllerModule from "../controllers/userController.js";
const {
  registerUser,
  loginUser,
  getMe: ctrlGetMe,
  getProfile: ctrlGetProfile,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
  forgotPassword,
  resetPassword,
  setVisibilityMe,
  unhideMe,
} = UserControllerModule.default || UserControllerModule;

const router = express.Router();

/* =============================================================================
   AUTH MIDDLEWARE (robust token extraction)
   - We keep this local to the router to avoid surprises if app-level auth
     changes. This accepts tokens from header, cookie or query.
============================================================================= */
function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
}
function tokenFromAuthHeader(req) {
  const h = req?.headers?.authorization;
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
function tokenFromCookies(req) {
  const c = req?.cookies || {};
  return c.accessToken || c.jwt || c.token || c.refreshToken || null;
}
function tokenFromQuery(req) {
  const q = req?.query || {};
  const v = q.token || q.access_token || q.accessToken;
  return typeof v === "string" && v.length ? v : null;
}
function resolveToken(req) {
  return tokenFromAuthHeader(req) || tokenFromCookies(req) || tokenFromQuery(req) || null;
}

// 🔐 Middleware: verify JWT and attach req.userId + req.user
function authenticateToken(req, res, next) {
  const token = resolveToken(req);
  if (!token) {
    res.set("WWW-Authenticate", 'Bearer realm="api"');
    return res.status(401).json({ error: "No token provided" });
  }
  const secret = pickFirstDefined(process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET);
  if (!secret) return res.status(500).json({ error: "Server JWT secret not configured" });
  try {
    const decoded = jwt.verify(token, secret);
    const id = String(decoded.id || decoded.userId || decoded.sub || decoded._id || "");
    if (!id) return res.status(401).json({ error: "Invalid token payload" });
    req.userId = id;
    req.user = { id, userId: id, role: decoded.role || "user", ...decoded };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* =============================================================================
   PATH HELPERS (used in image helpers and a few legacy flows)
============================================================================= */
function toWebPath(p) {
  if (!p || typeof p !== "string") return p;
  let s = p.replace(/\\/g, "/");
  if (!/^https?:\/\//i.test(s) && !s.startsWith("/")) s = `/${s}`;
  return s;
}

/* =============================================================================
   COMMON MIDDLEWARE
============================================================================= */
router.use(express.json());

/* =============================================================================
   MULTER (uploads) + helpers
============================================================================= */
const uploadsDir = pathFs.resolve(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  for (const sub of ["avatars", "extra"]) {
    const dir = pathFs.join(uploadsDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
} catch {
  /* noop */
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) =>
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        pathFs.extname(file.originalname)
    ),
});
const upload = multer({ storage });

function removeFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* noop */
  }
}

function mustBeSelfOrAdmin(req, res, next) {
  try {
    const paramId = String(req.params?.id || "");
    const myId = String(req.userId || req.user?.id || "");
    const role = (req.user?.role || "").toLowerCase();
    if (paramId && myId && (paramId === myId || role === "admin")) return next();
    return res.status(403).json({ error: "Forbidden" });
  } catch {
    return res.status(403).json({ error: "Forbidden" });
  }
}

/* =============================================================================
   PUBLIC AUTH ROUTES (pass-through to controller where applicable)
============================================================================= */
if (registerUser) router.post("/register", registerUser);
if (loginUser) router.post("/login", loginUser);
if (forgotPassword) router.post("/forgot-password", forgotPassword);
if (resetPassword) router.post("/reset-password", resetPassword);

/* =============================================================================
   PROFILE & ACCOUNT
   REQUIREMENT:
   - GET /api/users/profile and GET /api/users/me must share the SAME logic and
     MUST NOT cut fields (no whitelists). Only exclude password at query-time.
   - PUT /api/users/profile must return the FULL normalized user that matches
     a subsequent GET 1:1.
============================================================================= */

// --- REPLACE START: shared GET handlers always pass through normalizeUserOut ---
/**
 * We still allow existing controllers (ctrlGetProfile / ctrlGetMe). If these
 * are present and already fetch the document, we normalize their result here.
 * If not present, we fall back to a direct DB read.
 */
async function getFullProfile(req, res) {
  try {
    if (ctrlGetProfile) {
      // If controller writes directly, intercept by calling underlying DB ourselves after it?
      // Safer: do our own query to guarantee shape.
      const user = await User.findById(req.userId).select("-password");
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json(normalizeUserOut(user));
    }
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(normalizeUserOut(user));
  } catch (err) {
    console.error("GET /profile error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}

async function getFullMe(req, res) {
  try {
    if (ctrlGetMe) {
      const user = await User.findById(req.userId).select("-password");
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json(normalizeUserOut(user));
    }
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(normalizeUserOut(user));
  } catch (err) {
    console.error("GET /me error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}

router.get("/profile", authenticateToken, getFullProfile);
router.get("/me", authenticateToken, getFullMe);
// --- REPLACE END ---

/* =============================================================================
   VISIBILITY (hide / unhide)
   - Keep controller handlers for compatibility, but ensure responses normalize.
============================================================================= */
router.patch("/me/hide", authenticateToken, async (req, res) => {
  try {
    // Accept shim values for older FE
    const { hidden = true, minutes, resumeOnLogin } = req.body || {};
    if (!setVisibilityMe) {
      // Inline implementation if controller missing
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      user.isHidden = !!hidden;
      user.resumeOnLogin =
        typeof resumeOnLogin === "boolean" ? resumeOnLogin : user.resumeOnLogin;

      if (Number.isFinite(Number(minutes)) && Number(minutes) > 0) {
        const ms = Number(minutes) * 60 * 1000;
        user.hiddenUntil = new Date(Date.now() + ms);
      } else if (hidden) {
        user.hiddenUntil = null; // hide indefinitely
      } else {
        user.hiddenUntil = null; // unhide now
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    }

    // Delegate to controller then re-read to normalize
    await setVisibilityMe(req, res, async () => {
      const after = await User.findById(req.userId).select("-password");
      return res.json(normalizeUserOut(after));
    });
  } catch (err) {
    console.error("PATCH /me/hide error:", err?.message || err);
    return res.status(500).json({ error: "Visibility update failed" });
  }
});

router.patch("/me/unhide", authenticateToken, async (req, res) => {
  try {
    if (!unhideMe) {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      user.isHidden = false;
      user.hiddenUntil = null;
      await user.save();
      return res.json(normalizeUserOut(user));
    }
    await unhideMe(req, res, async () => {
      const after = await User.findById(req.userId).select("-password");
      return res.json(normalizeUserOut(after));
    });
  } catch (err) {
    console.error("PATCH /me/unhide error:", err?.message || err);
    return res.status(500).json({ error: "Visibility update failed" });
  }
});

/* =============================================================================
   UPDATE PROFILE
   - PUT /api/users/profile MUST return full normalized payload equal to GET.
============================================================================= */
function isPlaceholderString(v) {
  if (v === null || v === undefined) return false;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return (
    s === "" ||
    s === "select" ||
    s === "choose" ||
    s === "valitse" ||
    // IMPORTANT: do NOT treat "none" as placeholder; it's a valid DB value (e.g., pets = "none")
    // s === "none" ||
    s === "n/a" ||
    s === "-" ||
    s === "—"
  );
}
function applyFrontAliases(src) {
  const dst = { ...src };

  // Political ideology legacy alias
  if (
    (dst.politicalIdeology === undefined || isPlaceholderString(dst.politicalIdeology)) &&
    dst.ideology !== undefined
  ) {
    dst.politicalIdeology = dst.ideology;
    delete dst.ideology;
  }
  // Lifestyle → activityLevel
  if (
    dst.lifestyle !== undefined &&
    (dst.activityLevel === undefined || isPlaceholderString(dst.activityLevel))
  ) {
    dst.activityLevel = dst.lifestyle;
  }
  // Diet → nutritionPreferences
  if (
    dst.diet !== undefined &&
    (dst.nutritionPreferences === undefined || !Array.isArray(dst.nutritionPreferences))
  ) {
    if (Array.isArray(dst.diet)) dst.nutritionPreferences = dst.diet;
    else if (typeof dst.diet === "string" && !isPlaceholderString(dst.diet))
      dst.nutritionPreferences = [dst.diet];
  }
  // About → summary
  if (dst.about !== undefined && (dst.summary === undefined || isPlaceholderString(dst.summary))) {
    dst.summary = dst.about;
  }
  // Goals → goal
  if (dst.goals !== undefined && (dst.goal === undefined || isPlaceholderString(dst.goal))) {
    dst.goal = dst.goals;
  }
  // Searching for → lookingFor
  if (
    dst.searchingFor !== undefined &&
    (dst.lookingFor === undefined || isPlaceholderString(dst.lookingFor))
  ) {
    dst.lookingFor = dst.searchingFor;
  }
  // Smoking/Alcohol labels → smoke/drink
  ["smoking", "alcohol"].forEach((k) => {
    if (k in dst && typeof dst[k] === "string") {
      const target = k === "smoking" ? "smoke" : "drink";
      if (dst[target] === undefined || isPlaceholderString(dst[target])) {
        dst[target] = dst[k];
      }
    }
  });
  // Height/Weight sanitize strings
  if (dst.height !== undefined && typeof dst.height === "string") {
    dst.height = isPlaceholderString(dst.height) ? undefined : Number(dst.height);
  }
  if (dst.weight !== undefined && typeof dst.weight === "string") {
    dst.weight = isPlaceholderString(dst.weight) ? undefined : Number(dst.weight);
  }
  // Units: clear placeholders (keep real values like "Cm", "kg")
  if (dst.heightUnit !== undefined && isPlaceholderString(dst.heightUnit))
    dst.heightUnit = undefined;
  if (dst.weightUnit !== undefined && isPlaceholderString(dst.weightUnit))
    dst.weightUnit = undefined;

  return dst;
}

router.put(
  "/profile",
  authenticateToken,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "extraImages", maxCount: 20 },
  ]),
  [
    body("email").optional().isEmail().withMessage("Invalid email"),
    body("age").optional().isInt({ min: 18 }).withMessage("Age must be at least 18"),
    body("height").optional().isFloat({ min: 0, max: 300 }).withMessage("Height must be a number"),
    body("weight").optional().isFloat({ min: 0, max: 1000 }).withMessage("Weight must be a number"),
    body("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
    body("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const bodyIn = applyFrontAliases(req.body || {});
      const body = { ...bodyIn };

      // NOTE: "none" is a valid value for many selects; do NOT treat it as placeholder.
      const keysToClean = [
        "orientation",
        "education",
        "bodyType",
        "professionCategory",
        "profession",
        "religion",
        "religionImportance",
        "politicalIdeology",
        "children",
        "pets",
        "smoke",
        "drink",
        "drugs",
        "activityLevel",
        "summary",
        "goal",
        "lookingFor",
        "heightUnit",
        "weightUnit",
        "country",
        "region",
        "city",
      ];
      for (const k of keysToClean) {
        if (k in body && isPlaceholderString(body[k])) body[k] = undefined;
      }

      const fields = [
        "username",
        "email",
        "name",
        "age",
        "gender",
        "orientation",
        "height",
        "heightUnit",
        "weight",
        "weightUnit",
        "bodyType",
        "education",
        "professionCategory",
        "profession",
        "religion",
        "religionImportance",
        "politicalIdeology",
        "children",
        "pets",
        "smoke",
        "drink",
        "drugs",
        "nutritionPreferences",
        "activityLevel",
        "summary",
        "goal",
        "lookingFor",
        "country",
        "region",
        "city",
        "latitude",
        "longitude",
        "interests",
        "preferredGender",
        "preferredMinAge",
        "preferredMaxAge",
        "preferredInterests",
      ];

      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          const v = body[field];

          if (field === "interests" || field === "preferredInterests") {
            user[field] = Array.isArray(v)
              ? v
              : typeof v === "string"
              ? v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
            continue;
          }
          if (field === "nutritionPreferences") {
            user[field] = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
            continue;
          }
          if (field === "height" || field === "weight") {
            user[field] =
              v === undefined || v === null || v === "" ? undefined : Number(v);
            continue;
          }

          user[field] = v;
        }
      }

      // Mirror top-level country/region/city into nested location object
      if (
        body.country !== undefined ||
        body.region !== undefined ||
        body.city !== undefined
      ) {
        user.location = user.location || {};
        if (body.country !== undefined) user.location.country = body.country;
        if (body.region !== undefined) user.location.region = body.region;
        if (body.city !== undefined) user.location.city = body.city;
      }

      // Upload handling
      if (req.files?.profilePhoto?.length) {
        removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }
      if (req.files?.extraImages?.length) {
        (user.extraImages || []).forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
        user.photos = user.extraImages; // mirror to keep outbound consistent
      }

      const updated = await user.save();

      // ✅ Return the full normalized payload (exactly equals subsequent GET)
      return res.json(normalizeUserOut(updated));
    } catch (err) {
      console.error("PUT /profile error:", err?.message || err);
      return res.status(500).json({ error: "Profile update failed" });
    }
  }
);

/* =============================================================================
   PREMIUM (aliases maintained)
============================================================================= */
if (upgradeToPremium) {
  router.post("/upgrade-premium", authenticateToken, upgradeToPremium);
  router.post("/premium", authenticateToken, upgradeToPremium);
}

/* =============================================================================
   MATCHES & DISCOVERY (keep behavior, normalize outputs)
============================================================================= */

// Matches with score (controller-provided). We wrap response normalization
// if controller returns raw docs. If controller already writes to res, we skip.
router.get("/matches", authenticateToken, async (req, res, next) => {
  if (!getMatchesWithScore) return next(); // fall through to 404
  try {
    // Try to fetch ourselves to guarantee consistent output
    const me = await User.findById(req.userId).select("-password");
    if (!me) return res.status(404).json({ error: "User not found" });

    // Call controller but prefer to recompute/normalize directly afterwards
    let wrote = false;
    const hijackRes = {
      ...res,
      json(payload) {
        // If controller responds, we still normalize here for safety.
        try {
          if (Array.isArray(payload)) {
            const out = payload.map((u) => normalizeUserOut(u));
            wrote = true;
            return res.json(out);
          } else if (payload && payload.users) {
            const out = {
              ...payload,
              users: Array.isArray(payload.users)
                ? payload.users.map((u) => normalizeUserOut(u))
                : [],
            };
            wrote = true;
            return res.json(out);
          }
        } catch {
          /* fall back below */
        }
        wrote = true;
        return res.json(payload);
      },
    };
    await getMatchesWithScore(req, hijackRes, next);
    if (!wrote) {
      // Controller likely passed; provide a reasonable default:
      const others = await User.find({ _id: { $ne: req.userId } }).select("-password");
      return res.json(normalizeUsersOut(others));
    }
  } catch (err) {
    console.error("GET /matches error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =============================================================================
   SOCIAL GRAPH
============================================================================= */
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const target = req.params.id;
    if (!current || !target) return res.status(400).json({ error: "Invalid request" });
    if (!current.likes.includes(target)) {
      current.likes.push(target);
      await current.save();
    }
    res.json({ message: "Liked successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const target = req.params.id;
    if (!current || !target) return res.status(400).json({ error: "Invalid request" });

    const now = new Date();
    current.superLikeTimestamps = (current.superLikeTimestamps || []).filter(
      (ts) => now - new Date(ts) < 48 * 60 * 60 * 1000
    );
    const limit = current.isPremium ? 3 : 1;
    if (current.superLikeTimestamps.length >= limit) {
      return res.status(403).json({ error: "Superlike limit reached" });
    }
    if (!current.superLikes.includes(target)) {
      current.superLikes.push(target);
      current.superLikeTimestamps.push(now);
      await current.save();
    }
    res.json({ message: "Superliked successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const blockId = req.params.id;
    if (!me) return res.status(404).json({ message: "User not found" });
    if (me._id.equals(blockId)) return res.status(400).json({ message: "Cannot block yourself" });
    if (!me.blockedUsers.includes(blockId)) {
      me.blockedUsers.push(blockId);
      await me.save();
          }
    res.json({ message: "User blocked" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* =============================================================================
   IMAGES (UPLOAD / REORDER / SET-AVATAR)
============================================================================= */
router.post(
  "/:id/upload-avatar",
  authenticateToken,
  mustBeSelfOrAdmin,
  upload.single("profilePhoto"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      removeFile(user.profilePicture);
      user.profilePicture = req.file?.path;
      await user.save();

      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("upload-avatar error:", err?.message || err);
      res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

if (uploadExtraPhotos) {
  router.post(
    "/:id/upload-photos",
    authenticateToken,
    mustBeSelfOrAdmin,
    upload.array("photos", 8),
    uploadExtraPhotos
  );
}

if (uploadPhotoStep) {
  router.post(
    "/:id/upload-photo-step",
    authenticateToken,
    mustBeSelfOrAdmin,
    upload.single("photo"),
    uploadPhotoStep
  );
}

if (deletePhotoSlot) {
  router.delete(
    "/:id/photos/:slot",
    authenticateToken,
    mustBeSelfOrAdmin,
    (req, _res, next) => {
      if (!req.query) req.query = {};
      if (typeof req.query.slot === "undefined") req.query.slot = req.params.slot;
      if (typeof req.query.index === "undefined") req.query.index = req.params.slot;
      next();
    },
    deletePhotoSlot
  );
}

// Legacy: DELETE /:id/photo (kept to avoid breaking older clients)
router.delete(
  "/:id/photo",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Accept index via query (?index=2) or slot
      const idxRaw = req.query.index ?? req.query.slot;
      const idx = Number(idxRaw);
      const list =
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : user.extraImages || [];

      if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
        return res.status(400).json({ error: "Invalid index/slot" });
      }

      // Remove the file physically (best-effort)
      removeFile(list[idx]);

      const nextList = list.filter((_, i) => i !== idx);
      user.photos = nextList;
      user.extraImages = nextList;
      if (
        nextList.length &&
        (!user.profilePicture || !nextList.includes(toWebPath(user.profilePicture)))
      ) {
        user.profilePicture = nextList[0];
      }
      if (!nextList.length) {
        user.profilePicture = undefined;
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("DELETE /:id/photo error:", err?.message || err);
      res.status(500).json({ error: "Delete photo failed" });
    }
  }
);

// Reorder photos
router.put(
  "/:id/photos/reorder",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const order = Array.isArray(req.body?.order) ? req.body.order : null;
      if (!order || !order.length) {
        return res.status(400).json({ error: "Provide non-empty 'order' array" });
      }

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const orderNorm = order.map(toWebPath);
      const existing = (
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : user.extraImages || []
      ).map(toWebPath);

      const inOrder = orderNorm.filter((p) => existing.includes(p));
      const leftovers = existing.filter((p) => !inOrder.includes(p));
      const finalOrder = [...inOrder, ...leftovers];

      user.photos = finalOrder;
      user.extraImages = finalOrder;
      if (finalOrder.length) {
        user.profilePicture = finalOrder[0];
      } else {
        user.profilePicture = undefined;
      }

      await user.save();
      res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("photos/reorder error:", err?.message || err);
      res.status(500).json({ error: "Reorder failed" });
    }
  }
);

// Set avatar by path or index
router.post(
  "/:id/set-avatar",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      let { path, index } = req.body || {};
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const list = (
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : user.extraImages || []
      ).map(toWebPath);

      let chosen = null;

      if (typeof index !== "undefined" && index !== null) {
        const i = Number(index);
        if (Number.isInteger(i) && i >= 0 && i < list.length) {
          chosen = list[i];
        } else {
          return res.status(400).json({ error: "Invalid index" });
        }
      } else if (path) {
        const norm = toWebPath(String(path));
        if (!list.includes(norm)) {
          return res.status(400).json({ error: "Path not found in user photos" });
        }
        chosen = norm;
      } else {
        return res.status(400).json({ error: "Provide 'index' or 'path' to set as avatar" });
      }

      const reordered = [chosen, ...list.filter((p) => p !== chosen)];
      user.photos = reordered;
      user.extraImages = reordered;
      user.profilePicture = chosen;

      await user.save();
      res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("set-avatar error:", err?.message || err);
      res.status(500).json({ error: "Set avatar failed" });
    }
  }
);

/* =============================================================================
   LISTS & PUBLIC PROFILES
============================================================================= */
// Avoid positive projection; exclude only password so we never trim unknown keys.
router.get("/all", authenticateToken, async (_req, res) => {
  try {
    const list = await User.find({}).select("-password");
    res.json(normalizeUsersOut(list));
  } catch (err) {
    console.error("GET /all error:", err?.message || err);
    res.status(500).json({ error: "Server error" });
  }
});

// Validate :id before hitting public profile route
router.param("id", (_req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  return next();
});

// Public profile by ID (safe exclusions for public exposure)
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -email -likes -superLikes -blockedUsers"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(normalizeUserOut(user));
  } catch (err) {
    console.error("Public profile fetch error:", err?.message || err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
// --- REPLACE END ---
