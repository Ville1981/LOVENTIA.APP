// PATH: server/models/User.cjs

// --- REPLACE START: CommonJS schema with billing.stripeCustomerId + isPremium + superLikes.weekKey sync ---
/* eslint-disable no-console */
'use strict';

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

/**
 * User schema
 * - Keeps original structure and field names
 * - Adds missing fields used by the client (e.g., politicalIdeology, location, lifestyle, preferences)
 * - Provides virtuals for legacy aliases and convenience (country/region/city ↔ location.*, photos ↔ extraImages, etc.)
 * - Preserves CommonJS exports for maximum compatibility with existing code
 * - Visibility fields (visibility.*, isHidden/hidden virtuals, hiddenUntil, resumeOnLogin) + sync hooks
 * - ✅ Billing fields: `premium`, `isPremium`, top-level `stripeCustomerId` (legacy), `subscriptionId`, and **`billing.stripeCustomerId` (canonical)**
 * - ✅ Entitlements block (tier/features/quotas) to support FE expectations while mirroring legacy flags
 * - ✅ Adds `entitlements.quotas.superLikes.weekKey` (persisted) and keeps it in sync with legacy `window`
 * - ✅ This update adds (without breaking legacy):
 *      • lifestyle { smoke/drink/drugs } nested (mirrored with top-level smoke/drink/drugs)
 *      • orientationList: string[] (mirrored with legacy `orientation` string)
 *      • locationPoint: GeoJSON Point [lng,lat] + 2dsphere index (mirrored from latitude/longitude)
 *      • optional lastActive for Discover sorting
 *
 * NOTE:
 * This file is the **authoritative** User model for the app.
 * The ESM wrapper at server/src/models/User.js will try to load THIS file first.
 */

// Transform function to hide sensitive fields in JSON output.
// Keeps compatibility while preventing accidental leakage of secrets.
function safeTransform(_doc, ret) {
  try {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    // Email verification secrets should never leak to the client
    delete ret.emailVerifyToken;
    delete ret.emailVerifyExpires;
    // Mongoose internal fields clean-up (keep id via virtual)
    delete ret.__v;

    // Ensure visibility and top-level flags are consistent in API output
    const v = ret.visibility || {};
    const topIsHidden = typeof ret.isHidden === 'boolean' ? ret.isHidden : undefined;
    const visIsHidden = typeof v.isHidden === 'boolean' ? v.isHidden : undefined;
    const resolvedHidden =
      typeof topIsHidden === 'boolean'
        ? topIsHidden
        : (typeof visIsHidden === 'boolean' ? visIsHidden : false);

    ret.isHidden = resolvedHidden;
    ret.hidden = resolvedHidden; // legacy convenience
    const resolvedUntil = ret.hiddenUntil || v.hiddenUntil || null;
    ret.hiddenUntil = resolvedUntil;
    ret.visibility = {
      isHidden: resolvedHidden,
      hiddenUntil: resolvedUntil || null,
      resumeOnLogin:
        typeof v.resumeOnLogin === 'boolean'
          ? v.resumeOnLogin
          : (typeof ret.resumeOnLogin === 'boolean' ? ret.resumeOnLogin : true),
    };

    // ✅ Billing exposure in API output (normalize both places)
    ret.isPremium = !!ret.isPremium;
    ret.premium = !!ret.premium;

    // Ensure billing container exists
    if (!ret.billing || typeof ret.billing !== 'object') ret.billing = {};
    // Prefer nested billing.stripeCustomerId in API output; mirror top-level for legacy
    const nestedCid = ret.billing.stripeCustomerId || null;
    const topCid = ret.stripeCustomerId || null;
    const effectiveCid = nestedCid || topCid || null;

    ret.billing.stripeCustomerId = effectiveCid;
    ret.stripeCustomerId = effectiveCid; // keep legacy top-level view in responses
    if (!('subscriptionId' in ret)) ret.subscriptionId = null;

    // Output consistency for entitlements (keep legacy flags mirrored)
    if (ret.entitlements && typeof ret.entitlements === 'object') {
      const e = ret.entitlements;
      const legacy = !!(ret.isPremium || ret.premium);
      if (e.tier === 'free' && legacy) e.tier = 'premium'; // avoid mixed states in responses

      if (!e.features || typeof e.features !== 'object') {
        e.features = {
          seeLikedYou: false,
          superLikesPerWeek: 0,
          unlimitedLikes: false,
          unlimitedRewinds: false,
          dealbreakers: false,
          qaVisibilityAll: false,
          introsMessaging: false,
          noAds: false,
        };
      }

      if (!e.quotas || typeof e.quotas !== 'object') {
        e.quotas = { superLikes: { used: 0, weekKey: '', window: '' } };
      } else {
        const sl = (e.quotas.superLikes = e.quotas.superLikes || {});
        // Normalize keys (both exist for compatibility)
        if (sl.weekKey == null && typeof sl.window === 'string') sl.weekKey = sl.window;
        if (sl.window == null && typeof sl.weekKey === 'string') sl.window = sl.weekKey;
        if (typeof sl.used !== 'number') sl.used = 0;
        if (typeof sl.weekKey !== 'string') sl.weekKey = '';
        if (typeof sl.window !== 'string') sl.window = sl.weekKey || '';
      }
    }

    // ✅ ALWAYS return arrays for media fields
    if (!Array.isArray(ret.extraImages)) {
      ret.extraImages = ret.extraImages ? [ret.extraImages].filter(Boolean) : [];
    }
    if (!Array.isArray(ret.photos)) {
      // If photos was not array, use extraImages as source of truth
      ret.photos = Array.isArray(ret.extraImages) ? ret.extraImages : [];
    }

    // Ensure location flatten fields exist in output
    const loc = ret.location && typeof ret.location === 'object' ? ret.location : {};
    if (ret.country === undefined) ret.country = loc.country || ret.country || undefined;
    if (ret.region === undefined)  ret.region  = loc.region  || ret.region  || undefined;
    if (ret.city === undefined)    ret.city    = loc.city    || ret.city    || undefined;

    // Ensure preferences container exists in output for client consistency
    if (!ret.preferences || typeof ret.preferences !== 'object') {
      ret.preferences = {
        dealbreakers: {
          distanceKm: null,
          ageMin: null,
          ageMax: null,
          mustHavePhoto: false,
          nonSmokerOnly: false,
          noDrugs: false,
          petsOk: null,
          religion: [],
          education: [],
        },
      };
    } else if (!ret.preferences.dealbreakers) {
      ret.preferences.dealbreakers = {
        distanceKm: null,
        ageMin: null,
        ageMax: null,
        mustHavePhoto: false,
        nonSmokerOnly: false,
        noDrugs: false,
        petsOk: null,
        religion: [],
        education: [],
      };
    }

    // ✅ Ensure nested lifestyle exists in output and mirrors top-level if needed
    if (!ret.lifestyle || typeof ret.lifestyle !== 'object') {
      ret.lifestyle = {
        smoke: ret.smoke || '',
        drink: ret.drink || '',
        drugs: ret.drugs || '',
      };
    }

    // ✅ Ensure orientationList array exists in output (mirror from legacy orientation if needed)
    if (!Array.isArray(ret.orientationList)) {
      const arr = [];
      if (ret.orientation) arr.push(ret.orientation);
      ret.orientationList = arr;
    }

    // ✅ If GeoJSON is missing but lat/lng exists, expose a lightweight view (non-persisted)
    if (!ret.locationPoint && typeof ret.longitude === 'number' && typeof ret.latitude === 'number') {
      ret.locationPoint = { type: 'Point', coordinates: [ret.longitude, ret.latitude] };
    }
  } catch {
    // noop
  }
  return ret;
}

// Helper to ensure nested obj exists
function ensure(obj, key, fallback) {
  if (!obj[key] || typeof obj[key] !== 'object') obj[key] = fallback;
  return obj[key];
}

/* ----------------------- Preferences / Dealbreakers schemas ----------------------- */
const DealbreakersSchema = new mongoose.Schema(
  {
    distanceKm:    { type: Number,  default: null },
    ageMin:        { type: Number,  default: null },
    ageMax:        { type: Number,  default: null },
    mustHavePhoto: { type: Boolean, default: false },
    nonSmokerOnly: { type: Boolean, default: false },
    noDrugs:       { type: Boolean, default: false },
    petsOk:        { type: Boolean, default: null }, // tri-state
    religion:      { type: [String], default: [] },
    education:     { type: [String], default: [] },
  },
  { _id: false }
);

const PreferencesSchema = new mongoose.Schema(
  {
    dealbreakers: { type: DealbreakersSchema, default: () => ({}) },
  },
  { _id: false }
);

/* ----------------------- Lifestyle & Geo sub-schemas ----------------------- */
const LifestyleSchema = new mongoose.Schema(
  {
    smoke: { type: String, trim: true, default: '' }, // 'none'|'little'|'average'|'much'|'free' etc.
    drink: { type: String, trim: true, default: '' },
    drugs: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const GeoPointSchema = new mongoose.Schema(
  {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  { _id: false }
);

/* ----------------------- Rewind sub-schema (NEW) ----------------------- */
// --- REPLACE START: add rewind schema (visible & tolerant to legacy shapes) ---
const RewindActionSchema = new mongoose.Schema(
  {
    // Accept both "type" and legacy "action" (we store "type"; legacy can still be present)
    type:      { type: String, trim: true, default: 'like' },
    action:    { type: String, trim: true, default: undefined }, // legacy alias; kept if provided

    // Accept several id field names; we store targetId, but allow others to persist
    targetId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: undefined },
    target:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: undefined },       // legacy
    targetUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: undefined },       // alt
    target_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: undefined },       // alt

    // Timestamp (support "createdAt" and legacy "at")
    createdAt: { type: Date, default: () => new Date() },
    at:        { type: Date, default: undefined },
  },
  {
    _id: false,
    strict: false, // tolerate extra properties written by older controllers
  }
);
// --- REPLACE END ---

/* ----------------------- Main User schema ----------------------- */
const userSchema = new mongoose.Schema(
  {
    username:           { type: String, required: true, unique: true, trim: true },
    email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:           { type: String, required: true }, // expects a bcrypt hash in prod
    role:               { type: String, enum: ['user', 'admin'], default: 'user' },

    // ✅ Billing (legacy + authoritative flags)
    premium:            { type: Boolean, default: false },  // legacy flag kept for compatibility
    isPremium:          { type: Boolean, default: false },  // authoritative flag used by new logic

    // Legacy flat fields (kept for back-compat with older code paths)
    stripeCustomerId:   { type: String, default: null },
    subscriptionId:     { type: String, default: null },

    // ✅ Canonical billing container (requested): billing.stripeCustomerId
    billing: {
      stripeCustomerId: { type: String, default: null },
    },

    // ✅ Entitlements
    entitlements: {
      tier:   { type: String, enum: ['free','premium'], default: 'free' },
      since:  { type: Date },
      until:  { type: Date, default: null },
      features: {
        seeLikedYou:        { type: Boolean, default: false },
        superLikesPerWeek:  { type: Number,  default: 0 },
        unlimitedLikes:     { type: Boolean, default: false },
        unlimitedRewinds:   { type: Boolean, default: false },
        dealbreakers:       { type: Boolean, default: false },
        qaVisibilityAll:    { type: Boolean, default: false },
        introsMessaging:    { type: Boolean, default: false },
        noAds:              { type: Boolean, default: false },
      },
      quotas: {
        superLikes: {
          used:    { type: Number,  default: 0 },
          // New persisted key; kept in sync with legacy "window"
          weekKey: { type: String,  default: '' }, // e.g. 2025-W45
          window:  { type: String,  default: '' }, // legacy alias of weekKey
        },
      },
    },

    // Profile details
    name:               { type: String, trim: true },
    age:                { type: Number, min: 0, max: 130 },
    gender:             { type: String, trim: true },
    status:             { type: String, trim: true },
    religion:           { type: String, trim: true },
    religionImportance: { type: String, trim: true },
    children:           { type: String, trim: true },
    pets:               { type: String, trim: true },
    summary:            { type: String, trim: true },

    goal:               { type: String, trim: true },
    lookingFor:         { type: String, trim: true },
    profession:         { type: String, trim: true },
    professionCategory: { type: String, trim: true },
    bodyType:           { type: String, trim: true },
    height:             { type: Number, min: 0, max: 300 },
    heightUnit:         { type: String, trim: true },
    weight:             { type: Number, min: 0, max: 1000 },
    weightUnit:         { type: String, trim: true },
    education:          { type: String, trim: true },
    healthInfo:         { type: String, trim: true },
    activityLevel:      { type: String, trim: true },
    nutritionPreferences: { type: [String], default: [] },

    // Legacy single-orientation (kept)
    orientation:        { type: String, trim: true },
    // ✅ New: orientation list for multi-select filters
    orientationList:    { type: [String], default: [] },

    // Field persisted (with legacy alias)
    politicalIdeology: {
      type: String,
      enum: [
        '',
        'Left','Centre','Right',
        'Conservatism','Liberalism','Socialism','Communism','Fascism',
        'Environmentalism','Anarchism','Nationalism','Populism',
        'Progressivism','Libertarianism','Democracy','Other',
      ],
      default: '',
    },

    // Location block used by client; top-level virtuals map to these fields
    location: {
      country:          { type: String, trim: true },
      region:           { type: String, trim: true },
      city:             { type: String, trim: true },
    },

    // Custom location text overrides (optional)
    customCity:         { type: String, trim: true },
    customRegion:       { type: String, trim: true },
    customCountry:      { type: String, trim: true },

    // Coordinates (numeric)
    latitude:           { type: Number, min: -90, max: 90 },
    longitude:          { type: Number, min: -180, max: 180 },

    // ✅ GeoJSON point for $near queries (mirrored from latitude/longitude)
    locationPoint:      { type: GeoPointSchema, default: undefined },

    // Preferences used in Discover/filters
    preferredGender:    { type: String, default: 'any', trim: true },
    preferredMinAge:    { type: Number, default: 18, min: 18, max: 120 },
    preferredMaxAge:    { type: Number, default: 120, min: 18, max: 120 },
    preferredInterests: { type: [String], default: [] },

    interests:          { type: [String], default: [] },

    // Legacy lifestyle fields (kept) + ✅ nested lifestyle for new filters
    smoke:              { type: String, trim: true },
    drink:              { type: String, trim: true },
    drugs:              { type: String, trim: true },
    lifestyle:          { type: LifestyleSchema, default: () => ({}) },

    // Media
    profilePicture:     { type: String, trim: true },     // canonical single avatar path
    extraImages:        { type: [String], default: [] },  // gallery

    // Social graph
    likes:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    passes:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    superLikes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ✅ Superlike rate limiting (legacy helper; NOT the same as entitlements quota)
    superLikeTimestamps: [{ type: Date, default: undefined }],
    superLike: {
      weeklyUsed: { type: Number, default: 0 },
      weekStart:  { type: Date,   default: null },
    },

    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Password reset fields
    passwordResetToken:   { type: String, trim: true },
    passwordResetExpires: { type: Date },

    // Email verification fields
    emailVerifyToken:     { type: String, trim: true, default: null },
    emailVerifyExpires:   { type: Date, default: null },
    emailVerifiedAt:      { type: Date, default: null },

    passwordResetUsedAt:  { type: Date },

    // Visibility (both nested object and top-level helpers for compatibility)
    visibility: {
      isHidden:       { type: Boolean, default: false },
      hiddenUntil:    { type: Date, default: null },
      resumeOnLogin:  { type: Boolean, default: true },
    },

    // Top-level helpers kept for legacy code; kept in sync by hooks/virtuals
    isHidden:        { type: Boolean, default: false },
    hiddenUntil:     { type: Date, default: null },
    resumeOnLogin:   { type: Boolean, default: true },

    // ✅ NEW: preferences container (includes persisted dealbreakers)
    preferences:     { type: PreferencesSchema, default: () => ({}) },

    // ✅ Optional activity timestamp to help Discover sorting
    lastActive:      { type: Date, default: null },

    // --- REPLACE START: referral fields in User schema ---
    referralCode: { type: String, index: true, sparse: true, unique: false },
    referredBy:   { type: String, index: true },
    // --- REPLACE END ---

    // --- REPLACE START: add rewind schema (visible & tolerant to legacy shapes) ---
    rewind: {
      stack: { type: [RewindActionSchema], default: [] },
      max:   { type: Number, default: 50 }, // soft cap; maintained by pre-save below
    },
    // --- REPLACE END ---
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true, transform: safeTransform },
    toObject: { virtuals: true },
    strict: true,
  }
);

/* ----------------------- Virtuals ----------------------- */

// Virtuals to map top-level country/region/city to nested location.*
function ensureLocation(doc) {
  if (!doc.location) doc.location = {};
}

userSchema.virtual('country')
  .get(function () { return this.location ? this.location.country : undefined; })
  .set(function (v) { ensureLocation(this); this.location.country = v; });

userSchema.virtual('region')
  .get(function () { return this.location ? this.location.region : undefined; })
  .set(function (v) { ensureLocation(this); this.location.region = v; });

userSchema.virtual('city')
  .get(function () { return this.location ? this.location.city : undefined; })
  .set(function (v) { ensureLocation(this); this.location.city = v; });

// lat/lng conveniences
userSchema.virtual('lat')
  .get(function () { return this.latitude; })
  .set(function (v) { this.latitude = v; });

userSchema.virtual('lng')
  .get(function () { return this.longitude; })
  .set(function (v) { this.longitude = v; });

// Legacy alias: `ideology` → proxies to `politicalIdeology`
userSchema.virtual('ideology')
  .get(function () { return this.politicalIdeology; })
  .set(function (v) { this.politicalIdeology = v; });

// id as string (friendly)
userSchema.virtual('id').get(function () {
  try { return this._id ? this._id.toString() : undefined; } catch { return undefined; }
});

// Compatibility virtuals with older routes / client fields
userSchema.virtual('avatar')
  .get(function () { return this.profilePicture; })
  .set(function (v) { this.profilePicture = v; });

userSchema.virtual('profilePhoto')
  .get(function () { return this.profilePicture; })
  .set(function (v) { this.profilePicture = v; });

userSchema.virtual('photos')
  .get(function () { return Array.isArray(this.extraImages) ? this.extraImages : []; })
  .set(function (arr) { this.extraImages = Array.isArray(arr) ? arr.filter(Boolean) : []; });

userSchema.virtual('hidden')
  .get(function () { return !!(this.isHidden || (this.visibility && this.visibility.isHidden)); })
  .set(function (v) {
    const val = !!v;
    this.isHidden = val;
    if (!this.visibility || typeof this.visibility !== 'object') this.visibility = {};
    this.visibility.isHidden = val;
  });

/* ----------------------- Visibility & Billing & Lifestyle/Geo/Orientation sync hooks ----------------------- */
function syncVisibility(doc) {
  try {
    if (!doc.visibility || typeof doc.visibility !== 'object') doc.visibility = {};

    const topHidden = typeof doc.isHidden === 'boolean' ? doc.isHidden : undefined;
    const visHidden = typeof doc.visibility.isHidden === 'boolean' ? doc.visibility.isHidden : undefined;
    const resolvedHidden = typeof topHidden === 'boolean' ? topHidden : !!visHidden;

    const topUntil = doc.hiddenUntil || null;
    const visUntil = doc.visibility.hiddenUntil || null;
    const resolvedUntil = topUntil || visUntil || null;

    const topResume = typeof doc.resumeOnLogin === 'boolean' ? doc.resumeOnLogin : undefined;
    const visResume = typeof doc.visibility.resumeOnLogin === 'boolean' ? doc.visibility.resumeOnLogin : undefined;
    const resolvedResume = typeof topResume === 'boolean' ? topResume : (typeof visResume === 'boolean' ? visResume : true);

    doc.isHidden = resolvedHidden;
    doc.visibility.isHidden = resolvedHidden;

    doc.hiddenUntil = resolvedUntil;
    doc.visibility.hiddenUntil = resolvedUntil || null;

    doc.resumeOnLogin = resolvedResume;
    doc.visibility.resumeOnLogin = resolvedResume;
  } catch {
    // noop
  }
}

function syncBillingCustomerId(doc) {
  try {
    if (!doc.billing || typeof doc.billing !== 'object') doc.billing = {};
    const nested = doc.billing.stripeCustomerId || null;
    const top    = doc.stripeCustomerId || null;
    const effective = nested || top || null;

    doc.billing.stripeCustomerId = effective;
    doc.stripeCustomerId = effective;
  } catch {
    // noop
  }
}

function syncLifestyle(doc) {
  try {
    if (!doc.lifestyle || typeof doc.lifestyle !== 'object') doc.lifestyle = {};
    if (doc.smoke) doc.lifestyle.smoke = doc.smoke;
    else if (!doc.lifestyle.smoke) doc.lifestyle.smoke = '';

    if (doc.drink) doc.lifestyle.drink = doc.drink;
    else if (!doc.lifestyle.drink) doc.lifestyle.drink = '';

    if (doc.drugs) doc.lifestyle.drugs = doc.drugs;
    else if (!doc.lifestyle.drugs) doc.lifestyle.drugs = '';

    if (!doc.smoke && doc.lifestyle.smoke) doc.smoke = doc.lifestyle.smoke;
    if (!doc.drink && doc.lifestyle.drink) doc.drink = doc.lifestyle.drink;
    if (!doc.drugs && doc.lifestyle.drugs) doc.drugs = doc.lifestyle.drugs;
  } catch {
    // noop
  }
}

function syncOrientation(doc) {
  try {
    if (!Array.isArray(doc.orientationList)) doc.orientationList = [];
    if (doc.orientation && !doc.orientationList.includes(doc.orientation)) {
      doc.orientationList.push(doc.orientation);
    }
    if (!doc.orientation && doc.orientationList.length === 1) {
      doc.orientation = doc.orientationList[0];
    }
  } catch {
    // noop
  }
}

function syncGeoPoint(doc) {
  try {
    const hasNumbers = typeof doc.longitude === 'number' && typeof doc.latitude === 'number';
    if (hasNumbers) {
      if (!doc.locationPoint || typeof doc.locationPoint !== 'object') {
        doc.locationPoint = { type: 'Point', coordinates: [doc.longitude, doc.latitude] };
      } else {
        doc.locationPoint.type = 'Point';
        doc.locationPoint.coordinates = [doc.longitude, doc.latitude];
      }
    }
  } catch {
    // noop
  }
}

// --- REPLACE START: syncSuperLikesQuotaKeys ---

// Helper for ISO-like week key, e.g. "2025-W46"
function getCurrentWeekKey() {
  const now = new Date();
  const year = now.getUTCFullYear();

  // Find first Thursday of the year (ISO week reference)
  const firstThursday = new Date(Date.UTC(year, 0, 1));
  while (firstThursday.getUTCDay() !== 4) {
    firstThursday.setUTCDate(firstThursday.getUTCDate() + 1);
  }

  const diffDays = Math.floor((now - firstThursday) / 86400000);
  const week = 1 + Math.floor(diffDays / 7);

  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ✅ Keep weekKey/window in sync, but **never touch brand-new docs**
// This avoids Mongoose subdocument casting issues during register.
function syncSuperLikesQuotaKeys(doc) {
  try {
    // For newly created users, rely entirely on schema defaults.
    // This prevents any CastError from subdocument internals.
    if (doc && doc.isNew) {
      return;
    }

    const ent = doc.entitlements;
    if (!ent || typeof ent !== 'object') return;

    const quotas = ent.quotas;
    if (!quotas || typeof quotas !== 'object') return;

    const sl = quotas.superLikes;
    if (!sl || typeof sl !== 'object') return;

    // Ensure "used" is a number
    if (typeof sl.used !== 'number' || Number.isNaN(sl.used)) {
      sl.used = 0;
    }

    // Mirror weekKey/window both ways, but only if strings
    if (!sl.weekKey && typeof sl.window === 'string' && sl.window) {
      sl.weekKey = sl.window;
    }
    if (!sl.window && typeof sl.weekKey === 'string' && sl.weekKey) {
      sl.window = sl.weekKey;
    }

    // Sensible defaults if still missing
    if (!sl.weekKey || typeof sl.weekKey !== 'string') {
      sl.weekKey = getCurrentWeekKey();
    }
    if (!sl.window || typeof sl.window !== 'string') {
      sl.window = sl.weekKey;
    }
  } catch {
    // noop – never break validation because of this helper
  }
}

// --- REPLACE END: syncSuperLikesQuotaKeys ---



// ✅ Soft-cap rewind.stack length (keeps only newest N items based on rewind.max)
function capRewindStack(doc) {
  try {
    const cfgMax = (doc.rewind && typeof doc.rewind.max === 'number') ? doc.rewind.max : 50;
    if (doc.rewind && Array.isArray(doc.rewind.stack) && doc.rewind.stack.length > cfgMax) {
      // Keep newest first semantics → slice(0, cfgMax)
      doc.rewind.stack = doc.rewind.stack.slice(0, cfgMax);
    }
  } catch {
    // noop
  }
}

userSchema.pre('validate', function (next) {
  try {
    syncVisibility(this);
    syncBillingCustomerId(this);
    syncLifestyle(this);
    syncOrientation(this);
    syncGeoPoint(this);
    syncSuperLikesQuotaKeys(this);
    capRewindStack(this);
    next();
  } catch {
    next();
  }
});

userSchema.pre('save', function (next) {
  try {
    syncVisibility(this);
    syncBillingCustomerId(this);
    syncLifestyle(this);
    syncOrientation(this);
    syncGeoPoint(this);
    syncSuperLikesQuotaKeys(this);
    capRewindStack(this);
    next();
  } catch {
    next();
  }
});

/* ----------------------- Auth helper ----------------------- */
/**
 * findByCredentials
 * Accepts either a bcrypt-hashed password or a plain-text password (for legacy/dev).
 */
userSchema.statics.findByCredentials = async function (email, password) {
  if (!email || !password) return null;
  const candidate = await this.findOne({ email: String(email).toLowerCase().trim() }).exec();
  if (!candidate) return null;

  const stored = candidate.password || '';
  const looksHashed = /^\$2[aby]\$[0-9]{2}\$/.test(stored);

  if (looksHashed) {
    const ok = await bcrypt.compare(password, stored);
    return ok ? candidate : null;
  }
  return stored === password ? candidate : null;
};

/* ----------------------- Entitlements helpers ----------------------- */
function buildPremiumFeatures() {
  return {
    seeLikedYou:       true,
    superLikesPerWeek: 3,
    unlimitedLikes:    true,
    unlimitedRewinds:  true,
    dealbreakers:      true,
    qaVisibilityAll:   true,
    introsMessaging:   true,
    noAds:             true,
  };
}

userSchema.methods.startPremium = function startPremium() {
  const e = ensure(this, 'entitlements', { features: {}, quotas: { superLikes: {} } });
  e.tier = 'premium';
  e.since = new Date();
  e.until = null;
  e.features = { ...buildPremiumFeatures() };
  const sl = ensure(e, 'quotas', { superLikes: {} }).superLikes || {};
  sl.used = 0;
  sl.weekKey = '';
  sl.window = '';
  e.quotas.superLikes = sl;

  this.isPremium = true;
  this.premium = true;
};

userSchema.methods.stopPremium = function stopPremium() {
  const e = ensure(this, 'entitlements', { features: {}, quotas: { superLikes: {} } });
  e.tier = 'free';
  e.until = null;
  e.features = {
    seeLikedYou:       false,
    superLikesPerWeek: 0,
    unlimitedLikes:    false,
    unlimitedRewinds:  false,
    dealbreakers:      false,
    qaVisibilityAll:   false,
    introsMessaging:   false,
    noAds:             false,
  };
  const sl = ensure(e, 'quotas', { superLikes: {} }).superLikes || {};
  sl.used = 0;
  sl.weekKey = '';
  sl.window = '';
  e.quotas.superLikes = sl;

  this.isPremium = false;
  this.premium = false;
  this.subscriptionId = null;
};

userSchema.methods.reconcileFromStripeStatus = function (activeCount, latestActiveSubId = null, periodEnd = null) {
  if (activeCount > 0) {
    this.startPremium();
    if (periodEnd instanceof Date) {
      const e = ensure(this, 'entitlements', { features: {}, quotas: { superLikes: {} } });
      e.until = periodEnd;
    }
    if (latestActiveSubId) this.subscriptionId = latestActiveSubId;
  } else {
    this.stopPremium();
  }
};

userSchema.methods.hasFeature = function hasFeature(featureKey) {
  if (!featureKey) return false;
  const premium =
    this.isPremium === true ||
    this.premium === true ||
    (this.entitlements && this.entitlements.tier === 'premium');

  if (premium) return true;

  const f = this.entitlements && this.entitlements.features ? this.entitlements.features : {};
  return !!f[featureKey];
};

/* ----------------------- Indexes ----------------------- */
try {
  userSchema.index({ username: 1 }, { name: 'idx_user_username', unique: true });
  userSchema.index({ email: 1 }, { name: 'idx_user_email', unique: true });
  userSchema.index(
    { 'location.country': 1, 'location.region': 1, 'location.city': 1 },
    { name: 'idx_user_location' }
  );
  userSchema.index({ gender: 1, age: 1 }, { name: 'idx_user_gender_age' });
  userSchema.index({ latitude: 1, longitude: 1 }, { name: 'idx_user_lat_lng' });
  userSchema.index({ locationPoint: '2dsphere' }, { name: 'idx_user_locationPoint_2dsphere' });
  userSchema.index(
    { isHidden: 1, 'visibility.isHidden': 1, hiddenUntil: 1, 'visibility.hiddenUntil': 1 },
    { name: 'idx_user_visibility' }
  );
  userSchema.index(
    { 'entitlements.tier': 1, isPremium: 1 },
    { name: 'idx_user_entitlements_tier' }
  );
  userSchema.index({ 'billing.stripeCustomerId': 1 }, { name: 'idx_user_billing_stripe_customer' });
  userSchema.index({ stripeCustomerId: 1 }, { name: 'idx_user_stripe_customer_legacy' });
  userSchema.index({ subscriptionId: 1 }, { name: 'idx_user_subscription' });
  userSchema.index(
    { 'preferences.dealbreakers.distanceKm': 1, 'preferences.dealbreakers.mustHavePhoto': 1 },
    { name: 'idx_user_pref_dealbreakers_basic' }
  );
  userSchema.index({ orientationList: 1 }, { name: 'idx_user_orientation_list' });
  userSchema.index({ lastActive: -1 }, { name: 'idx_user_lastActive' });
} catch {
  /* noop */
}

/* ----------------------- Model export ----------------------- */
let UserModel;
try {
  UserModel = mongoose.model('User');
} catch {
  UserModel = mongoose.model('User', userSchema);
}

module.exports = UserModel;
module.exports.User = UserModel;
module.exports.default = UserModel;
// --- REPLACE END ---


