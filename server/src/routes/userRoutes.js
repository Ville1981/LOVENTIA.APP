// PATH: server/src/routes/userRoutes.js

// --- REPLACE START: migrate file to ESM and unify output normalizer across /me, /profile & PUT /profile ---
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import pathFs from "path";
import fs from "fs";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";
// --- REPLACE END ---

// --- REPLACE START: configuration/constants carried from legacy user.js ---
const FREE_LIKES_PER_DAY = Number(process.env.FREE_LIKES_PER_DAY || 30);
// --- REPLACE END ---

// Model (ESM/CJS interop)
// --- REPLACE START: lazy-load User model (keeps ESM/CJS interop) & remove duplicate 'User' redeclaration ---
let _UserModel = null;
async function getUserModel() {
  if (_UserModel) return _UserModel;
  try {
    const mod = await import("../models/User.js");
    _UserModel = mod.default || mod.User || mod;
  } catch (e) {
    _UserModel = null;
  }
  return _UserModel;
}
// NOTE: Removed invalid/duplicate `const User = UserModule.default || UserModule;`
// --- REPLACE END ---

// Use the single shared normalizer — do NOT re-implement
import normalizeUserOut, {
  normalizeUsersOut,
} from "../utils/normalizeUserOut.js";

// --- REPLACE START: optional Notifications support (best-effort) ---
let _NotificationsController = null;
let _NotificationModel = null;
async function getNotificationsHelper() {
  if (_NotificationsController || _NotificationModel) return { _NotificationsController, _NotificationModel };
  try {
    const ctrl = await import("../controllers/notificationsController.js");
    _NotificationsController = ctrl?.default || ctrl || {};
  } catch (_e) {
    _NotificationsController = {};
  }
  try {
    const model = await import("../models/Notification.js");
    _NotificationModel = model?.default || model || {};
  } catch (_e) {
    _NotificationModel = {};
  }
  return { _NotificationsController, _NotificationModel };
}
// --- REPLACE END ---

// Load controller (supports both default and named). We keep these for
// existing flows (auth, matches, premium, photo helpers) but ensure that
// the profile GET/PUT routes below always pass their result through
// normalizeUserOut so FE sees a complete, consistent shape.
// --- REPLACE START: lazy-load userController to prevent import-time failures, remove undefined `UserControllerModule` ---
let _UserController = null;
async function getUserController() {
  if (_UserController) return _UserController;
  try {
    const mod = await import("../controllers/userController.js");
    _UserController = mod.default || mod;
  } catch (_e) {
    _UserController = {};
  }
  return _UserController;
}
// NOTE: Removed invalid destructuring from `UserControllerModule.default || UserControllerModule`
// We will resolve controller functions inside route handlers to avoid top-level timing issues.
// --- REPLACE END ---

const router = express.Router();

// --- REPLACE START: ensure User model is available on req (lazy) ---
router.use(async (req, res, next) => {
  if (!req.UserModel) {
    try {
      const M = await getUserModel();
      req.UserModel = M || null;
    } catch {
      req.UserModel = null;
    }
  }
  return next();
});
// --- REPLACE END ---

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
// --- REPLACE START: stronger normalization to enforce `/uploads/...` canonical paths ---
function toWebPath(p) {
  if (!p || typeof p !== "string") return p;
  let s = String(p).replace(/\\\\/g, "/").replace(/\\/g, "/");
  // strip host if present
  s = s.replace(/^https?:\/\/[^/]+/i, "");
  // remove leading /uploads/ if repeated; keep single
  s = s.replace(/^\/?uploads\/?/i, "");
  // ensure single leading /uploads/
  s = `/uploads/${s}`.replace(/\/{2,}/g, "/");
  return s;
}
// --- REPLACE END ---

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
      Date.now() + "-" + Math.round(Math.random() * 1e9) + pathFs.extname(file.originalname)
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

// --- REPLACE START: conditional multer wrapper from legacy (JSON or multipart) ---
/**
 * maybeUpload(fields)
 * - If Content-Type is multipart/form-data -> run the multer fields parser.
 * - Otherwise -> no-op (do not force multipart).
 */
function maybeUpload(fields) {
  const fieldsMw = upload.fields(fields);
  return (req, res, next) => {
    const ct = String(req.headers["content-type"] || "");
    if (ct.toLowerCase().startsWith("multipart/form-data")) {
      return fieldsMw(req, res, next);
    }
    // Not multipart — skip file parsing so JSON bodies work
    return next();
  };
}
// --- REPLACE END ---

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
   (Resolve controller lazily inside handlers to avoid top-level race conditions)
============================================================================= */
// --- REPLACE START: sanitize auth bodies so premium cannot be set accidentally ---
function stripPremiumFields(req, _res, next) {
  if (req?.body && typeof req.body === "object") {
    delete req.body.premium;
    delete req.body.isPremium;
    delete req.body.entitlements;
    delete req.body.subscriptionId;
    delete req.body.stripeCustomerId;
  }
  next();
}
// --- REPLACE END ---

// --- REPLACE START: mount auth endpoints with lazy controller resolution ---
router.post("/register", stripPremiumFields, async (req, res, next) => {
  const { registerUser } = await getUserController();
  return typeof registerUser === "function" ? registerUser(req, res, next) : res.sendStatus(404);
});
router.post("/login", stripPremiumFields, async (req, res, next) => {
  const { loginUser } = await getUserController();
  return typeof loginUser === "function" ? loginUser(req, res, next) : res.sendStatus(404);
});
router.post("/forgot-password", async (req, res, next) => {
  const { forgotPassword } = await getUserController();
  return typeof forgotPassword === "function" ? forgotPassword(req, res, next) : res.sendStatus(404);
});
router.post("/reset-password", async (req, res, next) => {
  const { resetPassword } = await getUserController();
  return typeof resetPassword === "function" ? resetPassword(req, res, next) : res.sendStatus(404);
});
// --- REPLACE END ---

/* =============================================================================
   PROFILE & ACCOUNT
   REQUIREMENT:
   - GET /api/users/profile and GET /api/users/me must share the SAME logic and
     MUST NOT cut fields (no whitelists). Only exclude password at query-time.
   - PUT /api/users/profile must return the FULL normalized user that matches
     a subsequent GET 1:1.
============================================================================= */

// --- REPLACE START: shared GET handlers always pass through normalizeUserOut ---
async function getFullProfile(req, res) {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });
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
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });
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
    const { setVisibilityMe } = await getUserController();
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const { hidden = true, minutes, resumeOnLogin } = req.body || {};
    if (!setVisibilityMe) {
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
    const { unhideMe } = await getUserController();
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

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
  // --- REPLACE START: allow JSON or multipart (legacy parity) ---
  maybeUpload([
    { name: "profilePhoto", maxCount: 1 },
    { name: "extraImages", maxCount: 20 },
  ]),
  // --- REPLACE END ---
  [
    body("email").optional().isEmail().withMessage("Invalid email"),
    body("age").optional().isInt({ min: 18 }).withMessage("Age must be at least 18"),
    body("height").optional().isFloat({ min: 0, max: 300 }).withMessage("Height must be a number"),
    body("weight").optional().isFloat({ min: 0, max: 1000 }).withMessage("Weight must be a number"),
    body("latitude").optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
    body("longitude").optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

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

      // Upload handling (only if multipart was used)
      if (req.files?.profilePhoto?.length) {
        removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }
      if (req.files?.extraImages?.length) {
        (user.extraImages || []).forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
        user.photos = user.extraImages; // keep outbound consistent
      }

      const updated = await user.save();

      // Return the full normalized payload (exactly equals subsequent GET)
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
// --- REPLACE START: keep routes, resolve controller lazily on call ---
router.post("/upgrade-premium", authenticateToken, async (req, res, next) => {
  const { upgradeToPremium } = await getUserController();
  return typeof upgradeToPremium === "function" ? upgradeToPremium(req, res, next) : res.sendStatus(404);
});
router.post("/premium", authenticateToken, async (req, res, next) => {
  const { upgradeToPremium } = await getUserController();
  return typeof upgradeToPremium === "function" ? upgradeToPremium(req, res, next) : res.sendStatus(404);
});
// --- REPLACE END ---

/* =============================================================================
   MATCHES & DISCOVERY (keep behavior, normalize outputs)
============================================================================= */
router.get("/matches", authenticateToken, async (req, res, next) => {
  const { getMatchesWithScore } = await getUserController();
  if (!getMatchesWithScore) return next();
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const me = await User.findById(req.userId).select("-password");
    if (!me) return res.status(404).json({ error: "User not found" });

    let wrote = false;
    const hijackRes = {
      ...res,
      json(payload) {
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
      const others = await User.find({ _id: { $ne: req.userId } }).select("-password");
      return res.json(normalizeUsersOut(others));
    }
  } catch (err) {
    console.error("GET /matches error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =============================================================================
   SOCIAL GRAPH (Like / Superlike / Block)
============================================================================= */

// --- REPLACE START: ❤ Like with FREE daily quota enforcement (from legacy) ---
function startOfTodayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const current = await User.findById(req.userId);
    const targetId = String(req.params.id || "");

    if (!current || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid request" });
    }
    if (current._id.equals(targetId)) {
      return res.status(400).json({ error: "Cannot like yourself" });
    }

    const isPremium =
      !!(current.isPremium || current.premium || current?.entitlements?.tier === "premium");

    // Quota: FREE only
    if (!isPremium) {
      const start = startOfTodayUTC();
      current.likeTimestamps = (current.likeTimestamps || []).filter(
        (ts) => new Date(ts) >= start
      );
      if (current.likeTimestamps.length >= FREE_LIKES_PER_DAY) {
        return res.status(403).json({
          error: "Daily like limit reached",
          quota: {
            limit: FREE_LIKES_PER_DAY,
            used: current.likeTimestamps.length,
            remaining: 0,
          },
        });
      }
    }

    // Record like + timestamp
    if (!Array.isArray(current.likes)) current.likes = [];
    if (!current.likes.includes(targetId)) {
      current.likes.push(targetId);
    }
    current.likeTimestamps = current.likeTimestamps || [];
    current.likeTimestamps.push(new Date());

    await current.save();

    const remaining =
      isPremium ? null : Math.max(0, FREE_LIKES_PER_DAY - (current.likeTimestamps || []).length);

    return res.json({
      message: "Liked successfully",
      quota: {
        limit: isPremium ? null : FREE_LIKES_PER_DAY,
        used: isPremium ? null : (current.likeTimestamps || []).length,
        remaining,
      },
    });
  } catch (e) {
    console.error("like error:", e?.message || e);
    res.status(500).json({ error: "Server error" });
  }
});
// --- REPLACE END ---

// --- REPLACE START: 🌟 Superlike (48h premium limits) + best-effort notification (from legacy) ---
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const current = await User.findById(req.userId);
    const targetId = String(req.params.id || "");

    if (!current || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid request" });
    }
    if (current._id.equals(targetId)) {
      return res.status(400).json({ error: "Cannot superlike yourself" });
    }

    const now = new Date();
    current.superLikeTimestamps = (current.superLikeTimestamps || []).filter(
      (ts) => now - new Date(ts) < 48 * 60 * 60 * 1000
    );

    const premium =
      current.isPremium || current.premium || current?.entitlements?.tier === "premium";
    const limit = premium ? 3 : 1;

    if (current.superLikeTimestamps.length >= limit) {
      return res.status(403).json({
        error: "Superlike limit reached",
        window: "48h",
        limit,
        used: current.superLikeTimestamps.length,
        remaining: Math.max(0, limit - current.superLikeTimestamps.length),
      });
    }

    if (!Array.isArray(current.superLikes)) current.superLikes = [];
    if (!current.superLikes.includes(targetId)) {
      current.superLikes.push(targetId);
      current.superLikeTimestamps.push(now);
      await current.save();
    }

    // Best-effort notification (non-blocking)
    try {
      const { _NotificationsController, _NotificationModel } = await getNotificationsHelper();
      const createNotificationHelper = _NotificationsController?.create;
      const Notification = _NotificationModel;

      const payload = {
        toUser: targetId,
        fromUser: req.userId,
        type: "superlike",
        message: "You got a Superlike!",
      };
      if (typeof createNotificationHelper === "function") {
        await createNotificationHelper(payload);
      } else if (Notification && typeof Notification.create === "function") {
        await Notification.create(payload);
      }
    } catch (notifyErr) {
      console.warn("[superlike] notification failed:", notifyErr?.message || notifyErr);
    }

    // File: server/src/routes/userRoutes.js  (tail continuation)

// --- REPLACE START: tail continuation from the truncated section ---
    return res.json({
      message: "Superliked successfully",
      window: "48h",
      limit,
      used: current.superLikeTimestamps.length,
      remaining: Math.max(0, limit - current.superLikeTimestamps.length),
    });
  } catch (e) {
    console.error("superlike error:", e?.message || e);
    res.status(500).json({ error: "Server error" });
  }
});
// --- REPLACE END ---

// 🚫 Block user
router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ message: "User model not available" });

    const me = await User.findById(req.userId);
    const blockId = String(req.params.id || "");
    if (!me) return res.status(404).json({ message: "User not found" });
    if (!mongoose.Types.ObjectId.isValid(blockId))
      return res.status(400).json({ message: "Invalid user ID" });
    if (me._id.equals(blockId)) return res.status(400).json({ message: "Cannot block yourself" });

    if (!Array.isArray(me.blockedUsers)) me.blockedUsers = [];
    if (!me.blockedUsers.includes(blockId)) {
      me.blockedUsers.push(blockId);
      await me.save();
    }
    res.json({ message: "User blocked" });
  } catch (err) {
    console.error("block error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =============================================================================
   PARAM VALIDATION (prevent non-ObjectId from hitting '/:id')
============================================================================= */
router.param("id", (_req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  return next();
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
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

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

// --- REPLACE START: direct upload-photos without controller; normalize and return full user ---
router.post(
  "/:id/upload-photos",
  authenticateToken,
  mustBeSelfOrAdmin,
  // Accept both "photos" and "photos[]" field names
  upload.fields([{ name: "photos", maxCount: 8 }, { name: "photos[]", maxCount: 8 }]),
  async (req, res) => {
    try {
      console.log("[upload-photos] HIT direct handler (no controller)");

      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      // Collect files from both field variants
      const files =
        [
          ...(req.files?.photos || []),
          ...(req.files?.["photos[]"] || []),
        ] || [];

      if (!files.length) {
        return res.status(400).json({ error: "No files uploaded (use field 'photos')" });
      }

      const userId = req.params.id;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Merge new paths to existing list (keep existing order)
      const newPaths = files.map((f) => f.path);
      const current = Array.isArray(user.photos) && user.photos.length
        ? user.photos
        : (user.extraImages || []);

      const merged = [...current, ...newPaths];
      user.photos = merged;
      user.extraImages = merged;

      // Ensure avatar/profilePicture exists
      if (!user.profilePicture && merged.length) {
        user.profilePicture = merged[0];
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("upload-photos (direct) error:", err?.message || err);
      return res.status(500).json({ error: "Upload photos failed" });
    }
  }
);
// --- REPLACE END ---

// --- REPLACE START: safer res.json interception for upload-photo-step ---
router.post(
  "/:id/upload-photo-step",
  authenticateToken,
  mustBeSelfOrAdmin,
  upload.single("photo"),
  async (req, res, next) => {
    try {
      const { uploadPhotoStep } = await getUserController();
      if (typeof uploadPhotoStep !== "function") return res.sendStatus(404);


      const User = await getUserModel();
      let wrote = false;

      // Preserve original res.json and override safely
      const originalJson = res.json.bind(res);
      res.json = async (payload) => {
        try {
          if (User) {
            const fresh = await User.findById(req.params.id).select("-password");
            wrote = true;
            return originalJson(normalizeUserOut(fresh || payload));
          }
        } catch {
          /* fall through and return original payload */
        }
        wrote = true;
        return originalJson(payload);
      };

      await uploadPhotoStep(req, res, next);

      // Restore original res.json
      res.json = originalJson;

      if (!wrote) {
        try {
          const fresh = await User.findById(req.params.id).select("-password");
          return res.json(normalizeUserOut(fresh));
        } catch {
          return res.status(200).json({ ok: true });
        }
      }
    } catch (err) {
      console.error("upload-photo-step handler error:", err?.message || err);
      return res.status(500).json({ error: "Upload photo step failed" });
    }
  }
);
// --- REPLACE END ---

// Support both REST styles:
// 1) DELETE /:id/photos/:slot
// 2) DELETE /:id/photos?index=… | ?path=…

// --- REPLACE START: direct delete-by-slot; no controller; always return normalized user ---
router.delete(
  "/:id/photos/:slot",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const { id, slot } = req.params;
      const idx = Number(slot);

      if (!Number.isInteger(idx) || idx < 0) {
        return res.status(400).json({ error: "Invalid slot index" });
      }

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const list = Array.isArray(user.photos) && user.photos.length
        ? user.photos
        : (user.extraImages || []);

      if (idx >= list.length) {
        return res.status(400).json({ error: "Invalid slot index (out of range)" });
      }

      // Best-effort: remove physical file
      removeFile(list[idx]);

      // Remove from arrays
      const next = list.filter((_, i) => i !== idx);
      user.photos = next;
      user.extraImages = next;

      // Keep avatar/profilePicture consistent
      if (next.length) {
        // If current avatar not in list, move first as avatar
        const normalizedNext = next.map(toWebPath);
        const currentAvatar = toWebPath(user.profilePicture || "");
        if (!normalizedNext.includes(currentAvatar)) {
          user.profilePicture = next[0];
        }
      } else {
        user.profilePicture = undefined;
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("DELETE /:id/photos/:slot (direct) error:", err?.message || err);
      return res.status(500).json({ error: "Delete photo failed" });
    }
  }
);
// --- REPLACE END ---


// --- REPLACE START: direct query-only photo delete; no controller; always return normalized user ---
router.delete(
  "/:id/photos",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const { id } = req.params;
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const list = Array.isArray(user.photos) && user.photos.length
        ? user.photos
        : (user.extraImages || []);

      let didRemove = false;

      // Prefer ?index=... when provided
      if (typeof req.query.index !== "undefined") {
        const idx = Number(req.query.index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
          return res.status(400).json({ error: "Invalid index" });
        }
        // Best-effort remove file from disk
        removeFile(list[idx]);
        const next = list.filter((_, i) => i !== idx);
        user.photos = next;
        user.extraImages = next;
        didRemove = true;
      } else if (typeof req.query.path === "string" && req.query.path.trim().length) {
        const norm = toWebPath(String(req.query.path));
        const mapped = list.map(toWebPath);
        if (!mapped.includes(norm)) {
          return res.status(400).json({ error: "Path not found in user photos" });
        }
        // Best-effort remove file from disk
        removeFile(norm);
        const next = list.filter((p) => toWebPath(p) !== norm);
        user.photos = next;
        user.extraImages = next;
        didRemove = true;
      } else {
        return res.status(400).json({ error: "Provide 'index' or 'path'" });
      }

      // Keep avatar/profilePicture consistent
      if (didRemove) {
        if (user.photos.length) {
          const normalizedNext = user.photos.map(toWebPath);
          const currentAvatar = toWebPath(user.profilePicture || "");
          if (!normalizedNext.includes(currentAvatar)) {
            user.profilePicture = user.photos[0];
          }
        } else {
          user.profilePicture = undefined;
        }
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error('DELETE /:id/photos (direct) error:', err?.message || err);
      return res.status(500).json({ error: "Delete photo failed" });
    }
  }
);
// --- REPLACE END ---


// Legacy: DELETE /:id/photo (kept to avoid breaking older clients)
router.delete(
  "/:id/photo",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

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
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

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
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

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
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const list = await User.find({}).select("-password");
    res.json(normalizeUsersOut(list));
  } catch (err) {
    console.error("GET /all error:", err?.message || err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- REPLACE START: add legacy-compatible path /users/all (from old user.js) ---
router.get("/users/all", authenticateToken, async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const list = await User.find({ _id: { $ne: req.userId } })
      .select("-password -resetToken -passwordResetToken -passwordResetExpires -__v")
      .lean();

    const out = (list || []).map((u) => {
      if (u.profilePicture) u.profilePicture = toWebPath(u.profilePicture);
      if (Array.isArray(u.photos)) u.photos = u.photos.map(toWebPath);
      if (Array.isArray(u.extraImages)) u.extraImages = u.extraImages.map(toWebPath);
      return normalizeUserOut(u);
    });

    res.json(out);
  } catch (err) {
    console.error("/users/all error:", err?.message || err);
    res.status(401).json({ error: "Invalid token" });
  }
});
// --- REPLACE END ---

// (Removed duplicate router.param("id") definition that previously appeared here)

// Public profile by ID (safe exclusions for public exposure)
router.get("/:id", async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

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

// --- REPLACE START: CJS compatibility export for app.js tryRequireRoute ---
/**
 * Ensure the router is visible both to ESM `import` (default)
 * and to any CommonJS/require-based loader that expects a function.
 * This helps when app.js uses a generic tryRequireRoute and checks
 * `typeof userRoutes === "function"` before mounting.
 */
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== "undefined" && module && typeof module.exports !== "undefined") {
    // Expose the router directly for `require(...)`
    // so that code doing `typeof x === "function"` passes.
    // eslint-disable-next-line no-undef
    module.exports = router;
    // eslint-disable-next-line no-undef
    module.exports.default = router;
  }
} catch (_e) {
  /* noop */
}
// --- REPLACE END ---

/* =============================================================================
   NOTES
   - Brought over from legacy user.js:
     * Conditional multipart parsing (maybeUpload) so JSON-only PUT /profile works.
     * FREE daily like quota with JWT-authenticated enforcement and counters.
     * Superlike 48h window limits + premium limit + best-effort notifications.
     * Legacy /users/all route retained alongside /all.
   - GET /me and GET /profile return FULL profile using:
     findById().select("-password ...") + normalizeUserOut(user).
   - Ensured there are NO inclusive selects like .select("username email ..."):
     only exclusive selects (minus sensitive fields) are used.
   - The replacement regions are marked between // --- REPLACE START and // --- REPLACE END
     so you can verify exactly what changed.
   - Change in this update:
     * Added CommonJS interop export block (at the very end) to satisfy app.js
       `tryRequireRoute` function checks.
     * Removed a duplicate `router.param("id")` definition to avoid redundancy.
============================================================================= */














