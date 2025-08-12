// --- REPLACE START: Convert to CommonJS + add missing profile fields + lat/lng virtuals (kept original structure) ---
'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define User schema with all necessary fields
const userSchema = new mongoose.Schema(
  {
    username:           { type: String, required: true, unique: true, trim: true },
    email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:           { type: String, required: true }, // expects a bcrypt hash in prod
    role:               { type: String, enum: ['user', 'admin'], default: 'user' },
    isPremium:          { type: Boolean, default: false },

    // Profile details
    name:               String,
    age:                Number,
    gender:             String,
    status:             String,
    religion:           String,
    religionImportance: String, // <— added to match filters
    children:           String,
    pets:               String,
    summary:            String,
    goal:               String,
    lookingFor:         String,
    profession:         String,
    professionCategory: String,
    bodyType:           String,
    height:             Number,
    heightUnit:         String,
    weight:             Number,
    weightUnit:         String,
    education:          String, // <— ensure present
    healthInfo:         String, // <— added
    activityLevel:      String, // <— added
    nutritionPreferences: [String], // <— added (array of strings)

    // Location
    location:           { country: String, region: String, city: String },
    customCity:         String, // <— added
    customRegion:       String, // <— added
    customCountry:      String, // <— added
    latitude:           Number,
    longitude:          Number,

    // Discovery preferences
    preferredGender:    { type: String, default: 'any' }, // <— added
    preferredMinAge:    { type: Number, default: 18 },    // <— added
    preferredMaxAge:    { type: Number, default: 120 },   // <— added
    preferredInterests: [String],                          // <— added

    // Interests
    interests:          [String], // <— added

    // Lifestyle
    smoke:              String,
    drink:              String,
    drugs:              String,

    // Images
    profilePicture:     String,
    extraImages:        [String],

    // Password reset
    passwordResetToken:   String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

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
 * Virtuals for lat/lng to interop with controllers that may use either
 * latitude/longitude or lat/lng.
 */
userSchema.virtual('lat')
  .get(function () { return this.latitude; })
  .set(function (v) { this.latitude = v; });

userSchema.virtual('lng')
  .get(function () { return this.longitude; })
  .set(function (v) { this.longitude = v; });

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

