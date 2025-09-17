// File: server/tests/setup.js

// --- REPLACE START ---
/**
 * Global Jest setup for server tests.
 * - Spins up an in-memory MongoDB instance
 * - Injects MONGO_URI into process.env BEFORE app import
 * - Keeps collections clean between tests
 * - Shuts everything down after the run
 *
 * NOTE:
 *  - Requires devDependency: mongodb-memory-server
 *  - Works with our ESM/Babel Jest setup
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongo;

/** Helper for suites to bulk insert documents */
export async function insertMany(model, docs) {
  if (!model || !docs) return [];
  try {
    return await model.insertMany(docs);
  } catch (e) {
    // Keep failures visible but do not crash setup helpers
    // Tests should assert appropriately.
    // eslint-disable-next-line no-console
    console.warn("[tests/setup] insertMany failed:", e?.message || e);
    return [];
  }
}

/** Helper to wipe all collections between tests */
export async function dropAll() {
  const { collections } = mongoose.connection;
  for (const name of Object.keys(collections)) {
    try {
      // deleteMany instead of drop for stability across runs
      await collections[name].deleteMany({});
    } catch {
      // ignore per-collection issues to avoid masking primary test failures
    }
  }
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  // Ensure the app under test will see these
  process.env.MONGO_URI = uri;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret";

  // Connect mongoose globally so routes/controllers using the shared connection work
  await mongoose.connect(uri, {
    autoIndex: true,
    dbName: "loventia_test",
  });
});

afterEach(async () => {
  // Clean collections to isolate tests
  await dropAll();
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      // Best-effort cleanup; ignore errors to not hide test results
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect().catch(() => {});
    }
  } finally {
    if (mongo) {
      await mongo.stop().catch(() => {});
    }
  }
});
// --- REPLACE END ---
