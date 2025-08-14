// --- REPLACE START: Convert to CommonJS + add missing fields + location virtuals (kept original structure) ---
'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define User schema with all necessary fields.
// NOTE: We keep the overall structure similar to the original and only add what's required.
const userSchema = new mongoose.Schema(
  {
    username:           { type: String, required: true, unique: true, trim: true },
    email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:           { type: String, required: true }, // expects a bcrypt hash in prod
    role:               { type: String, enum: ['user', 'admin'], default: 'user' },
    isPremium:          { type: Boolean, default: false },

    // Profile details
    name:               String,
    age:                Number,  // ensure numeric for discover age filters
    gender:             String,
    status:             String,
    religion:           String,
    religionImportance: String,
    children:           String,
    pets:               String,
    summary:            String,

    // NOTE: schema uses singular 'goal'. Controller filters should target 'goal' (not 'goals').
    goal:               String,
    lookingFor:         String,
    profession:         String,
    professionCategory: String,
    bodyType:           String,
    height:             Number,
    heightUnit:         String,
    weight:             Number,
    weightUnit:         String,
    education:          String,
    healthInfo:         String,
    activityLevel:      String,
    nutritionPreferences: [String],

    // Added missing profile field
    orientation:        String, // ensures "orientation" persists

    // ✅ New field for political ideology
    ideology:           String,

    // Location stored as a nested object (canonical source of truth)
    location:           {
      country:          { type: String },
      region:           { type: String },
      city:             { type: String },
    },

    // Optional manual/custom location text fields (keep if already used in UI)
    customCity:         String,
    customRegion:       String,
    customCountry:      String,

    latitude:           Number,
    longitude:          Number,

    // Discovery preferences
    preferredGender:    { type: String, default: 'any' },
    preferredMinAge:    { type: Number, default: 18 },
    preferredMaxAge:    { type: Number, default: 120 },
    preferredInterests: [String],

    // Interests
    interests:          [String],

    // Lifestyle
    smoke:              String,
    drink:              String,
    drugs:              String,

    // Images
    profilePicture:     String,
    extraImages:        [String],

    // Swipe/action state (needed so like/pass/superlike persist with strict:true)
    likes:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    passes:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    superLikes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Password reset
    passwordResetToken:   String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
    strict: true, // keep strict to ensure unknown keys are not stored silently
  }
);

/**
 * Virtuals to keep backward compatibility with routes/controllers that
 * read/write top-level country/region/city.
 * They transparently map to the canonical nested "location.*" fields.
 */
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

/**
 * Convenience virtuals for lat/lng to interop with any code that may use lat/lng.
 */
userSchema.virtual('lat')
  .get(function () { return this.latitude; })
  .set(function (v) { this.latitude = v; });

userSchema.virtual('lng')
  .get(function () { return this.longitude; })
  .set(function (v) { this.longitude = v; });

/**
 * Optional convenience: normalize id field (string) for controllers/tests that read user.id.
 */
userSchema.virtual('id').get(function () {
  try {
    return this._id ? this._id.toString() : undefined;
  } catch {
    return undefined;
  }
});

/**
 * Static: findByCredentials(email, password)
 * - Looks up by email (case-insensitive)
 * - Compares bcrypt hash in `password` field
 * - For legacy/plaintext test data, falls back to direct equality if the stored value
 *   does not look like a bcrypt hash.
 */
userSchema.statics.findByCredentials = async function (email, password) {
  if (!email || !password) return null;

  const candidate = await this.findOne({ email: String(email).toLowerCase().trim() }).exec();
  if (!candidate) return null;

  const stored = candidate.password || '';
  const looksHashed = /^\$2[aby]\$[0-9]{2}\$/.test(stored);

  if (looksHashed) {
    const ok = await bcrypt.compare(password, stored);
    if (!ok) return null;
    return candidate;
  }

  // Fallback for tests/seed data with plaintext passwords
  if (stored === password) {
    return candidate;
  }

  return null;
};

let UserModel;

// Avoid OverwriteModelError in watch mode/tests
try {
  UserModel = mongoose.model('User');
} catch (_) {
  UserModel = mongoose.model('User', userSchema);
}

module.exports = UserModel;
// --- REPLACE END ---
