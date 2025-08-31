// --- REPLACE START: Convert to CommonJS + add missing fields + location + visibility sync + entitlements (kept original structure) ---
'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User schema
 * - Keeps original structure and field names
 * - Adds missing fields used by the client (e.g., politicalIdeology, location, lifestyle, preferences)
 * - Provides virtuals for legacy aliases and convenience (country/region/city ↔ location.*, photos ↔ extraImages, etc.)
 * - Preserves CommonJS exports for maximum compatibility with existing code
 * - Visibility fields (visibility.*, isHidden/hidden virtuals, hiddenUntil, resumeOnLogin) + sync hooks
 * - ✅ Billing fields: `premium`, `isPremium`, `stripeCustomerId`, `subscriptionId`
 * - ✅ Entitlements block (tier/features/quotas) to support runbook §11 without breaking legacy flags
 */

// Transform function to hide sensitive fields in JSON output.
// Keeps compatibility while preventing accidental leakage of secrets.
function safeTransform(_doc, ret) {
  try {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
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

    // ✅ Explicitly keep billing fields visible in API output (never hide these)
    ret.isPremium = !!ret.isPremium;
    ret.premium = !!ret.premium;
    if (!('stripeCustomerId' in ret)) ret.stripeCustomerId = null;
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
        e.quotas = { superLikes: { used: 0, window: '' } };
      }
    }

    // Ensure preferences container exists in output for client consistency
    if (!ret.preferences || typeof ret.preferences !== 'object') {
      ret.preferences = { dealbreakers: {
        distanceKm: null,
        ageMin: null,
        ageMax: null,
        mustHavePhoto: false,
        nonSmokerOnly: false,
        noDrugs: false,
        petsOk: null,
        religion: [],
        education: [],
      }};
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
// Keeping these small and explicit ensures Mongoose persists values (fixes PATCH→GET mismatch)
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

/* ----------------------- Main User schema ----------------------- */
// IMPORTANT: `politicalIdeology` replaces legacy `ideology`. A virtual alias is provided for backward compatibility.
const userSchema = new mongoose.Schema(
  {
    username:           { type: String, required: true, unique: true, trim: true },
    email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:           { type: String, required: true }, // expects a bcrypt hash in prod
    role:               { type: String, enum: ['user', 'admin'], default: 'user' },

    // ✅ Billing (legacy + authoritative flags)
    premium:            { type: Boolean, default: false },  // legacy flag kept for compatibility
    isPremium:          { type: Boolean, default: false },  // authoritative flag used by new logic
    stripeCustomerId:   { type: String, default: null },
    subscriptionId:     { type: String, default: null },

    // ✅ Entitlements (single source of truth for feature access; kept simple first)
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
          used:   { type: Number, default: 0 },
          window: { type: String, default: '' }, // e.g. 2025-W35
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
    orientation:        { type: String, trim: true },

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

    // Preferences used in Discover/filters
    preferredGender:    { type: String, default: 'any', trim: true },
    preferredMinAge:    { type: Number, default: 18, min: 18, max: 120 },
    preferredMaxAge:    { type: Number, default: 120, min: 18, max: 120 },
    preferredInterests: { type: [String], default: [] },

    interests:          { type: [String], default: [] },

    // Lifestyle filters
    smoke:              { type: String, trim: true },
    drink:              { type: String, trim: true },
    drugs:              { type: String, trim: true },

    // Media
    profilePicture:     { type: String, trim: true },     // canonical single avatar path
    extraImages:        { type: [String], default: [] },  // gallery

    // Social graph
    likes:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    passes:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    superLikes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ✅ ADDED: timestamps for superlike rate limiting (persisted)
    superLikeTimestamps: [{ type: Date, default: undefined }],

    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Password reset fields
    passwordResetToken:   { type: String, trim: true },
    passwordResetExpires: { type: Date },

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

// Compatibility virtuals with older routes / client fields:
// - `avatar` / `profilePhoto` ↔ profilePicture
userSchema.virtual('avatar')
  .get(function () { return this.profilePicture; })
  .set(function (v) { this.profilePicture = v; });

userSchema.virtual('profilePhoto')
  .get(function () { return this.profilePicture; })
  .set(function (v) { this.profilePicture = v; });

// - `photos` (array) ↔ extraImages
userSchema.virtual('photos')
  .get(function () { return Array.isArray(this.extraImages) ? this.extraImages : []; })
  .set(function (arr) {
    this.extraImages = Array.isArray(arr) ? arr.filter(Boolean) : [];
  });

// - `hidden` (legacy) ↔ `isHidden`
userSchema.virtual('hidden')
  .get(function () { return !!(this.isHidden || (this.visibility && this.visibility.isHidden)); })
  .set(function (v) {
    const val = !!v;
    this.isHidden = val;
    if (!this.visibility || typeof this.visibility !== 'object') this.visibility = {};
    this.visibility.isHidden = val;
  });

/* ----------------------- Visibility sync hooks ----------------------- */
/**
 * Keep top-level (isHidden, hiddenUntil, resumeOnLogin) and nested visibility.* in sync.
 * This ensures both old and new clients get the flags they expect.
 */
function syncVisibility(doc) {
  try {
    if (!doc.visibility || typeof doc.visibility !== 'object') doc.visibility = {};

    // Decide canonical values (prefer explicit top-level if present)
    const topHidden = typeof doc.isHidden === 'boolean' ? doc.isHidden : undefined;
    const visHidden = typeof doc.visibility.isHidden === 'boolean' ? doc.visibility.isHidden : undefined;
    const resolvedHidden = typeof topHidden === 'boolean' ? topHidden : !!visHidden;

    const topUntil = doc.hiddenUntil || null;
    const visUntil = doc.visibility.hiddenUntil || null;
    const resolvedUntil = topUntil || visUntil || null;

    const topResume = typeof doc.resumeOnLogin === 'boolean' ? doc.resumeOnLogin : undefined;
    const visResume = typeof doc.visibility.resumeOnLogin === 'boolean' ? doc.visibility.resumeOnLogin : undefined;
    const resolvedResume = typeof topResume === 'boolean' ? topResume : (typeof visResume === 'boolean' ? visResume : true);

    // Write back to both places
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

// Pre-validate/Pre-save to keep fields aligned
userSchema.pre('validate', function (next) { try { syncVisibility(this); next(); } catch { next(); } });
userSchema.pre('save',      function (next) { try { syncVisibility(this); next(); } catch { next(); } });

/* ----------------------- Auth helper ----------------------- */
/**
 * findByCredentials
 * Accepts either a bcrypt-hashed password or a plain-text password (for legacy/dev).
 * Returns the user document if credentials match, otherwise null.
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

/* ----------------------- Entitlements helpers (server-side feature toggles) ----------------------- */
/**
 * Build default Premium features. Keep aligned with runbook §11.2.
 */
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
/**
 * Start Premium: updates entitlements and legacy flags.
 */
userSchema.methods.startPremium = function startPremium() {
  const e = ensure(this, 'entitlements', { features: {}, quotas: { superLikes: {} } });
  e.tier = 'premium';
  e.since = new Date();
  e.until = null;
  e.features = { ...buildPremiumFeatures() };
  const sl = ensure(e, 'quotas', { superLikes: {} }).superLikes || {};
  sl.used = 0;
  sl.window = ''; // let API set current ISO week on first use
  e.quotas.superLikes = sl;

  this.isPremium = true;
  this.premium = true; // legacy mirror
};

/**
 * Stop Premium: clears features and legacy flags.
 */
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
  sl.window = '';
  e.quotas.superLikes = sl;

  this.isPremium = false;
  this.premium = false; // legacy mirror
  this.subscriptionId = null;
};

/**
 * Reconcile entitlements from Stripe status (activeCount).
 * If activeCount>0 → premium, else free.
 */
userSchema.methods.reconcileFromStripeStatus = function (activeCount, latestActiveSubId = null, periodEnd = null) {
  if (activeCount > 0) {
    this.startPremium();
    if (periodEnd instanceof Date) {
      // If the sub is cancel_at_period_end but still active, allow UI to show "ends on ..."
      const e = ensure(this, 'entitlements', { features: {}, quotas: { superLikes: {} } });
      e.until = periodEnd;
    }
    if (latestActiveSubId) this.subscriptionId = latestActiveSubId;
  } else {
    this.stopPremium();
  }
};

/**
 * ✅ New: instance method to ask "does this user have feature X?"
 * Mirrors middleware logic; safe for server-side checks in services/controllers.
 */
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
  // Keep separate numeric indexes for potential range queries
  userSchema.index({ latitude: 1, longitude: 1 }, { name: 'idx_user_lat_lng' });

  // Helpful query for Discover visibility
  userSchema.index(
    { isHidden: 1, 'visibility.isHidden': 1, hiddenUntil: 1, 'visibility.hiddenUntil': 1 },
    { name: 'idx_user_visibility' }
  );

  // Entitlements quick filters
  userSchema.index(
    { 'entitlements.tier': 1, isPremium: 1 },
    { name: 'idx_user_entitlements_tier' }
  );

  // Billing lookups
  userSchema.index({ stripeCustomerId: 1 }, { name: 'idx_user_stripe_customer' });
  userSchema.index({ subscriptionId: 1 }, { name: 'idx_user_subscription' });

  // Preferences lookups (future-proofing for dealbreakers queries)
  userSchema.index(
    { 'preferences.dealbreakers.distanceKm': 1, 'preferences.dealbreakers.mustHavePhoto': 1 },
    { name: 'idx_user_pref_dealbreakers_basic' }
  );
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
module.exports.User = UserModel;        // named export (interop)
module.exports.default = UserModel;     // default-like export (interop)
// --- REPLACE END ---
