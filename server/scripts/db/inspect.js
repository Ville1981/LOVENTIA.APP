// --- REPLACE START: DB inspect helper (CommonJS) ---
'use strict';

/**
 * Inspect current Mongo connection target and basic stats.
 * - Uses MONGO_URI from .env by default
 * - You can pass a URI as the first CLI arg to override .env
 *
 * Usage:
 *   node server/scripts/db/inspect.js
 *   node server/scripts/db/inspect.js "mongodb+srv://..."
 */

const path = require('path');
const fs = require('fs');
const dotenvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

const mongoose = require('mongoose');

(async function main() {
  const uriFromArg = process.argv[2];
  const MONGO_URI = uriFromArg || process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('[inspect] Missing MONGO_URI (env or first argument).');
    process.exit(1);
  }

  console.log('[inspect] Connecting to:', MONGO_URI);
  mongoose.set('strictQuery', false);

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = conn.connection.db;
    const dbName = db.databaseName;
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    let userCount = 0;
    try {
      userCount = await db.collection('users').countDocuments();
    } catch {}

    console.log('---------------------------------------------');
    console.log('[inspect] DB name        :', dbName);
    console.log('[inspect] Collections    :', names);
    console.log('[inspect] users count    :', userCount);
    console.log('[inspect] NODE_ENV       :', process.env.NODE_ENV || '(not set)');
    console.log('---------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[inspect] Error:', err?.message || err);
    process.exit(1);
  }
})();
// --- REPLACE END ---
