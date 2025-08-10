// --- REPLACE START: Username migration (CommonJS) ---
'use strict';

/**
 * One-off migration to fill missing username fields.
 * - Builds username from email local-part when empty/missing
 * - Run first with --dry-run to see what would change
 *
 * Usage:
 *   node server/scripts/db/migrateUsernames.js --dry-run
 *   node server/scripts/db/migrateUsernames.js
 *   node server/scripts/db/migrateUsernames.js "mongodb+srv://..." --dry-run
 */

const path = require('path');
const fs = require('fs');
const dotenvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

const mongoose = require('mongoose');

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  const uriArg = [...args].find(a => a.startsWith('mongodb://') || a.startsWith('mongodb+srv://'));
  const dryRun = args.has('--dry-run');
  return { uriArg, dryRun };
}

(async function main() {
  const { uriArg, dryRun } = parseArgs(process.argv);
  const MONGO_URI = uriArg || process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('[migrateUsernames] Missing MONGO_URI (env or first argument).');
    process.exit(1);
  }

  console.log('[migrateUsernames] Connecting to:', MONGO_URI);
  console.log('[migrateUsernames] Dry-run       :', dryRun ? 'YES' : 'NO');

  mongoose.set('strictQuery', false);

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const db = conn.connection.db;

    const match = {
      $or: [
        { username: { $exists: false } },
        { username: '' },
        { username: null },
      ],
    };

    const preview = await db.collection('users')
      .find(match, { projection: { _id: 1, email: 1, username: 1 } })
      .limit(20)
      .toArray();

    console.log(`[migrateUsernames] Preview (first 20):`);
    console.table(preview.map(u => ({
      _id: u._id?.toString?.() || u._id,
      email: u.email,
      username: u.username,
    })));

    if (dryRun) {
      const toFixCount = await db.collection('users').countDocuments(match);
      console.log(`[migrateUsernames] Would update ${toFixCount} users. (Dry-run)`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const pipeline = [
      {
        $set: {
          username: {
            $cond: [
              {
                $and: [
                  { $ne: [{ $type: '$username' }, 'missing'] },
                  { $gt: ['$username', ''] },
                ],
              },
              '$username',
              {
                $let: {
                  vars: { base: { $arrayElemAt: [{ $split: ['$email', '@'] }, 0] } },
                  in: { $substrCP: ['$$base', 0, 30] },
                },
              },
            ],
          },
        },
      },
    ];

    const result = await db.collection('users').updateMany(match, pipeline);
    console.log('[migrateUsernames] Modified count:', result.modifiedCount);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[migrateUsernames] Error:', err?.message || err);
    process.exit(1);
  }
})();
// --- REPLACE END ---
