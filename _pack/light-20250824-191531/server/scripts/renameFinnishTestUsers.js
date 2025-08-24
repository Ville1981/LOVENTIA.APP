// --- REPLACE START: ESM migration to rename Finnish "Testikäyttäjä" to "Test User" ---
/**
 * One-off migration (ESM):
 *  - Finds users named "Testikäyttäjä" (or containing "käyttäjä", case-insensitive)
 *  - Renames to "Test User"
 * Idempotent. Requires MONGO_URI in env. Very verbose logs for diagnostics.
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

function log(step, extra = '') {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[rename][${ts}] ${step}${extra ? ' ' + extra : ''}`);
}

/* 1) Load env: try process CWD, then server/.env, then repo-root/.env */
(function loadEnv() {
  let loaded = false;

  // a) CWD/.env
  try {
    const res = dotenv.config();
    if (res.parsed) { loaded = true; log('Loaded .env from CWD'); }
  } catch {}

  // b) server/.env (relative to this script)
  if (!loaded) {
    const p = path.resolve(__dirname, '../.env');
    try {
      if (fs.existsSync(p)) {
        const res = dotenv.config({ path: p });
        if (res.parsed) { loaded = true; log('Loaded .env from server/.env'); }
      }
    } catch {}
  }

  // c) repo-root/.env (../../.env)
  if (!loaded) {
    const p = path.resolve(__dirname, '../../.env');
    try {
      if (fs.existsSync(p)) {
        const res = dotenv.config({ path: p });
        if (res.parsed) { loaded = true; log('Loaded .env from repo root .env'); }
      }
    } catch {}
  }

  if (!loaded) {
    log('No .env file found; relying on process env');
  }
})();

/* 2) Resolve User model regardless of export style (default/named) */
async function loadUserModel() {
  const candidates = [
    path.resolve(__dirname, '../models/User.js'),
    path.resolve(__dirname, '../models/User.cjs'),
    path.resolve(__dirname, '../models/user.js'),
  ];
  for (const p of candidates) {
    try {
      const mod = await import(pathToFileURL(p).href);
      const model = (mod && (mod.default || mod.User || mod.user)) || mod;
      if (!model) continue;
      log('Loaded User model from', p);
      return model;
    } catch {
      // try next
    }
  }
  throw new Error('[rename] Could not resolve User model under ../models/');
}

function required(name, val) {
  if (!val) throw new Error(`[rename] Missing required env var: ${name}`);
  return val;
}

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI || '';
}

mongoose.set('strictQuery', false);

async function run() {
  log('Start');
  const mongoUri = required('MONGO_URI', getMongoUri());
  log('Connecting to MongoDB...', `(MONGO_URI length=${mongoUri.length})`);

  await mongoose.connect(mongoUri);
  log('Connected');

  const User = await loadUserModel();

  // Candidates: exact match or any “käyttäjä” (case-insensitive)
  const query = {
    $or: [
      { name: 'Testikäyttäjä' },
      { name: { $regex: 'käyttäjä', $options: 'i' } },
    ],
  };

  log('Searching users with Finnish test name...');
  const users = await User.find(query).lean();
  log('Search done', `(count=${users.length})`);

  if (!users.length) {
    log('No users found to rename. Nothing to update.');
  } else {
    log('Updating users to name = "Test User"...');
    const ids = users.map((u) => u._id);
    const res = await User.updateMany(
      { _id: { $in: ids } },
      { $set: { name: 'Test User' } }
    );
    log('Update result', JSON.stringify(res));
  }

  log('Rename completed.');
}

run()
  .catch((err) => {
    const msg = err && err.stack ? err.stack : String(err);
    // eslint-disable-next-line no-console
    console.error(`[rename] ERROR: ${msg}`);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
      log('Disconnected');
    } catch {}
  });
// --- REPLACE END ---
