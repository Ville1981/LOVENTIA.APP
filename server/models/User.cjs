// --- REPLACE START: Convert to CommonJS + add findByCredentials static for Jest/dev ---
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
    location:           { country: String, region: String, city: String },
    latitude:           Number,
    longitude:          Number,

    // Images
    profilePicture:     String,
    extraImages:        [String],

    // Password reset
    passwordResetToken:   String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
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
