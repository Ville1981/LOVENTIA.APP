// --- REPLACE START: Convert to CommonJS + add missing fields + location virtuals (kept original structure) ---
'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define User schema with all necessary fields.
// IMPORTANT: `politicalIdeology` replaces legacy `ideology`. A virtual alias is provided for backward compatibility.
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
    religionImportance: String,
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
    education:          String,
    healthInfo:         String,
    activityLevel:      String,
    nutritionPreferences: { type: [String], default: [] },
    orientation:        String,

    // ✅ New field persisted
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

    location:           {
      country:          { type: String },
      region:           { type: String },
      city:             { type: String },
    },

    customCity:         String,
    customRegion:       String,
    customCountry:      String,

    latitude:           Number,
    longitude:          Number,

    preferredGender:    { type: String, default: 'any' },
    preferredMinAge:    { type: Number, default: 18 },
    preferredMaxAge:    { type: Number, default: 120 },
    preferredInterests: { type: [String], default: [] },

    interests:          { type: [String], default: [] },

    smoke:              String,
    drink:              String,
    drugs:              String,

    // Media
    profilePicture:     String,              // canonical single avatar path
    extraImages:        { type: [String], default: [] }, // gallery

    // Social graph
    likes:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    passes:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    superLikes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ✅ Password reset fields
    passwordResetToken:   String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
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

// id as string
userSchema.virtual('id').get(function () {
  try { return this._id ? this._id.toString() : undefined; } catch { return undefined; }
});

// 🧩 Compatibility virtuals with older routes / client fields:
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

/* ----------------------- Auth helper ----------------------- */

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

/* ----------------------- Indexes ----------------------- */

try {
  userSchema.index({ username: 1 }, { name: 'idx_user_username', unique: true });
  userSchema.index({ email: 1 }, { name: 'idx_user_email', unique: true });
  userSchema.index(
    { 'location.country': 1, 'location.region': 1, 'location.city': 1 },
    { name: 'idx_user_location' }
  );
  userSchema.index({ gender: 1, age: 1 }, { name: 'idx_user_gender_age' });
} catch { /* noop */ }

/* ----------------------- Model export ----------------------- */

let UserModel;
try { UserModel = mongoose.model('User'); }
catch { UserModel = mongoose.model('User', userSchema); }

module.exports = UserModel;
module.exports.User = UserModel;        // named export (interop)
module.exports.default = UserModel;     // default-like export (interop)
// --- REPLACE END ---
