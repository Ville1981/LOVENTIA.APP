// --- REPLACE START: minimal, safe seed (ESM) — inserts a few visible users; skips duplicates without conflicts ---
/**
 * Minimal seeding script for local/dev environments.
 * - Inserts 3 visible users with basic fields filled.
 * - Idempotent: skips already existing emails (no upserts, no $set conflicts).
 * - Uses your configured Mongo URI from either:
 *     1) server/src/config/env.js  → export { env } with env.MONGO_URI
 *     2) process.env.MONGO_URI     → from your .env/.env.local
 *
 * How to run (from repo root):
 *   node ./server/scripts/seed3.mjs
 *
 * Verification (PowerShell):
 *   $API="http://localhost:5000/api"
 *   Invoke-WebRequest -Method GET "$API/discover?includeHidden=1&limit=5"
 *
 * Notes:
 * - This script is standalone; it is NOT imported by the app.
 * - No passwords are used for login here; it’s only for discover feed testing.
 */

'use strict';

import mongoose from 'mongoose';

// Prefer config/env.js, fallback to process.env.MONGO_URI
let MONGO_URI = process.env.MONGO_URI;
try {
  const mod = await import('../src/config/env.js');
  const cfg = mod?.env || mod?.default || {};
  if (cfg?.MONGO_URI) MONGO_URI = cfg.MONGO_URI;
} catch {
  /* fallback to process.env */
}

if (!MONGO_URI) {
  console.error('[seed3] Missing MONGO_URI. Set it in server/src/config/env.js or .env');
  process.exit(1);
}

console.log('[seed3] Connecting to Mongo:', MONGO_URI.replace(/\/\/([^@]+)@/, '//***:***@'));
await mongoose.connect(MONGO_URI);

// ✅ Import the real project User model (no fallback schema)
import User from '../src/models/User.js';

// Helper: canonicalize uploads path to POSIX form
function toUpload(p) {
  if (!p || typeof p !== 'string') return null;
  let s = p.trim().replace(/\\/g, '/');
  s = s.replace(/^https?:\/\/[^/]+/i, '');
  s = s.replace(/^\/?uploads\/?/i, '');
  s = `/uploads/${s}`.replace(/\/{2,}/g, '/');
  return s;
}

const now = new Date();
const plus30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

// Seed users — write `visibility` as a whole object ONLY in insert docs
const seedUsers = [
  {
    email: 'alice@example.com',
    username: 'alice',
    name: 'Alice',
    gender: 'female',
    age: 28,
    location: { country: 'Finland', region: 'Uusimaa', city: 'Helsinki', coordinates: [] },
    visibility: { isHidden: false, hiddenUntil: null, resumeOnLogin: true },
    hidden: false,
    goal: 'Serious relationship',
    orientation: 'straight',
    orientationList: ['straight'],
    lifestyle: { smoke: 'no', drink: 'no', drugs: 'no' },
    photos: [toUpload('uploads/sample-alice-1.jpg'), toUpload('uploads/sample-alice-2.jpg')].filter(Boolean),
    extraImages: [],
    profilePicture: toUpload('uploads/sample-alice-1.jpg'),
    isPremium: false,
    entitlements: { tier: 'free', features: { noAds: false } },
    createdAt: now,
    updatedAt: now,
    password: 'x', // if your schema hashes on save, this is fine (dev-only)
  },
  {
    email: 'bob@example.com',
    username: 'bob',
    name: 'Bob',
    gender: 'male',
    age: 32,
    location: { country: 'Finland', region: 'Pirkanmaa', city: 'Tampere', coordinates: [] },
    visibility: { isHidden: false, hiddenUntil: null, resumeOnLogin: true },
    hidden: false,
    goal: 'Friendship',
    orientation: 'straight',
    orientationList: ['straight'],
    lifestyle: { smoke: 'no', drink: 'yes', drugs: 'no' },
    photos: [toUpload('uploads/sample-bob-1.jpg'), toUpload('uploads/sample-bob-2.jpg')].filter(Boolean),
    extraImages: [],
    profilePicture: toUpload('uploads/sample-bob-1.jpg'),
    isPremium: true,
    entitlements: {
      tier: 'premium',
      since: now.toISOString(),
      until: plus30d.toISOString(),
      features: { noAds: true, unlimitedLikes: true, unlimitedRewinds: true, dealbreakers: true },
      quotas: { superLikes: { used: 0, window: 'weekly' } },
    },
    createdAt: now,
    updatedAt: now,
    password: 'x',
  },
  {
    email: 'cara@example.com',
    username: 'cara',
    name: 'Cara',
    gender: 'female',
    age: 26,
    location: { country: 'Finland', region: 'Varsinais-Suomi', city: 'Turku', coordinates: [] },
    visibility: { isHidden: false, hiddenUntil: null, resumeOnLogin: true },
    hidden: false,
    goal: 'Dating',
    orientation: 'straight',
    orientationList: ['straight'],
    lifestyle: { smoke: 'no', drink: 'no', drugs: 'no' },
    photos: [toUpload('uploads/sample-cara-1.jpg'), toUpload('uploads/sample-cara-2.jpg')].filter(Boolean),
    extraImages: [],
    profilePicture: toUpload('uploads/sample-cara-1.jpg'),
    isPremium: false,
    entitlements: { tier: 'free', features: { noAds: false } },
    createdAt: now,
    updatedAt: now,
    password: 'x',
  },
];

const emails = seedUsers.map(u => u.email);
const existing = await User.find({ email: { $in: emails } }).select('email').lean();
const existingSet = new Set(existing.map(x => x.email));

const toInsert = seedUsers.filter(u => !existingSet.has(u.email));

let insertedCount = 0;
let skippedCount = seedUsers.length - toInsert.length;

if (toInsert.length === 0) {
  console.log('[seed3] All seed users already exist. Nothing to insert. skipped=', skippedCount);
} else {
  try {
    const res = await User.insertMany(toInsert, { ordered: false });
    insertedCount = Array.isArray(res) ? res.length : (res?.insertedCount || 0);
    console.log('[seed3] Inserted:', insertedCount, 'Skipped (already existed):', skippedCount);
  } catch (err) {
    // Handle duplicate key errors gracefully (if unique index on email)
    const isBulkDup =
      (err?.code === 11000) ||
      (Array.isArray(err?.writeErrors) && err.writeErrors.every(w => w?.code === 11000));
    if (isBulkDup) {
      insertedCount = err?.result?.result?.nInserted || 0;
      skippedCount = seedUsers.length - insertedCount;
      console.warn('[seed3] Some users already existed (duplicates). Inserted:', insertedCount, 'Skipped:', skippedCount);
    } else {
      console.error('[seed3] Insert failed:', err?.message || err);
      await mongoose.disconnect();
      process.exit(1);
    }
  }
}

await mongoose.disconnect();
console.log('[seed3] Done. Summary => inserted:', insertedCount, 'skipped:', skippedCount);
// --- REPLACE END ---
