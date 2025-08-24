// --- REPLACE START: Always reset and create test users for Discover/auth flow ---
'use strict';

/**
 * Seeder to (re)create a small set of test users for local/dev.
 * - Works in CommonJS Node env (no ESM required)
 * - Connects with MONGO_URI
 * - Deletes conflicting users by email/username before inserting
 * - Hashes passwords with bcrypt
 * - Normalizes image paths so client can render from `${BACKEND_BASE_URL}/uploads/...`
 */

const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/** Resolve User model whether it uses CJS or ESM default export */
function loadUserModel() {
  // Prefer local models/User.js relative to this script
  const candidates = [
    path.resolve(__dirname, '../models/User.js'),
    path.resolve(__dirname, '../models/User.cjs'),
    path.resolve(__dirname, '../models/user.js'),
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const mod = require(p);
      return mod && mod.default ? mod.default : mod;
    } catch {
      /* keep trying */
    }
  }
  throw new Error('[seed] Could not resolve User model in ../models/');
}

const User = loadUserModel();

function required(name, val) {
  if (!val) throw new Error(`[seed] Missing required env var: ${name}`);
  return val;
}

/**
 * Normalize any input to one clean path under /uploads.
 * - Converts "\" -> "/" (Windows)
 * - Removes "./" and duplicate slashes
 * - Ensures exactly one "/uploads/" prefix
 */
function normalizeUploadPath(input) {
  if (!input) return undefined;
  let p = String(input).trim();
  if (!p) return undefined;

  p = p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');

  if (p.startsWith('/uploads/')) {
    p = p.replace(/^\/uploads\/uploads\//, '/uploads/');
    return p;
  }
  if (p.startsWith('uploads/')) return `/${p}`;
  if (p.startsWith('/')) return `/uploads${p}`;
  return `/uploads/${p}`;
}

async function seedTestUsers() {
  const mongoUri = required('MONGO_URI', process.env.MONGO_URI);

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // One dedicated login user + a few visible profiles for /discover
  const rawUsers = [
    {
      email: 'testuser@example.com',
      password: 'TestPass123',
      username: 'testuser',
      name: 'Test User',
      role: 'user',
      age: 28,
      gender: 'Male',
      orientation: 'Straight',
      summary: 'This is a seeded login user for local dev.',
      profilePicture: 'bunny-avatar.jpg', // expected in /uploads
      extraImages: ['bunny1.jpg', 'bunny2.jpg', 'bunny3.jpg'],
      location: { city: 'Helsinki', region: 'Uusimaa', country: 'Finland' },
    },
    {
      email: 'alice@example.com',
      password: 'TestPass123',
      username: 'alice',
      name: 'Alice',
      role: 'user',
      age: 25,
      gender: 'Female',
      orientation: 'Straight',
      summary: 'Coffee, books, and long walks.',
      profilePicture: 'bunny1.jpg',
      extraImages: ['bunny2.jpg', 'bunny3.jpg'],
      location: { city: 'Tampere', region: 'Pirkanmaa', country: 'Finland' },
    },
    {
      email: 'bob@example.com',
      password: 'TestPass123',
      username: 'bob',
      name: 'Bob',
      role: 'user',
      age: 31,
      gender: 'Male',
      orientation: 'Straight',
      summary: 'Music producer. Gym + guitars.',
      profilePicture: 'bunny2.jpg',
      extraImages: ['bunny3.jpg'],
      location: { city: 'Espoo', region: 'Uusimaa', country: 'Finland' },
    },
    {
      email: 'carol@example.com',
      password: 'TestPass123',
      username: 'carol',
      name: 'Carol',
      role: 'user',
      age: 27,
      gender: 'Female',
      orientation: 'Bisexual',
      summary: 'Foodie & traveler ✈️',
      profilePicture: 'bunny3.jpg',
      extraImages: ['bunny1.jpg'],
      location: { city: 'Turku', region: 'Varsinais-Suomi', country: 'Finland' },
    },
    {
      email: 'dave@example.com',
      password: 'TestPass123',
      username: 'dave',
      name: 'Dave',
      role: 'user',
      age: 35,
      gender: 'Male',
      orientation: 'Gay',
      summary: 'Tech, movies, and board games.',
      profilePicture: 'bunny1.jpg',
      extraImages: [],
      location: { city: 'Oulu', region: 'Pohjois-Pohjanmaa', country: 'Finland' },
    },
  ];

  const emails = rawUsers.map((u) => u.email);
  const usernames = rawUsers.map((u) => u.username);

  // Remove existing with same emails/usernames to avoid unique index conflicts
  const delRes = await User.deleteMany({
    $or: [{ email: { $in: emails } }, { username: { $in: usernames } }],
  });
  console.log(`🗑️ Removed ${delRes.deletedCount || 0} existing users with seed identities`);

  // Insert (hash passwords, normalize images to /uploads/*)
  for (const u of rawUsers) {
    const hashed = await bcrypt.hash(u.password, 10);

    const profilePicture = normalizeUploadPath(u.profilePicture);
    const extraImages = Array.isArray(u.extraImages)
      ? u.extraImages.map(normalizeUploadPath).filter(Boolean)
      : [];

    const doc = new User({
      email: u.email,
      password: hashed,
      username: u.username,
      name: u.name,
      role: u.role || 'user',
      age: u.age,
      gender: u.gender,
      orientation: u.orientation,
      summary: u.summary,
      profilePicture,
      extraImages,
      location: u.location,
    });

    await doc.save();
    console.log(`✅ Created user: ${u.username} <${u.email}>`);
  }

  console.log('🎯 Seeding completed. Next steps:');
  console.log('   1) Login with: testuser@example.com / TestPass123');
  console.log('   2) Open /discover — you should see multiple profiles (your own excluded by default)');
}

seedTestUsers()
  .catch((err) => {
    console.error('❌ Error seeding test users:', err && err.stack ? err.stack : err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    } catch {
      /* ignore */
    }
  });
// --- REPLACE END ---
