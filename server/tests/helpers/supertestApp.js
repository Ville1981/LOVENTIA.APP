// File: server/tests/helpers/supertestApp.js

// --- REPLACE START: CommonJS helper that resolves the Express app via app.cjs bridge ---
/**
 * Supertest helper (CommonJS).
 * - Uses the CJS bridge (../../app.cjs), which returns a Promise<ExpressApp>
 * - Exports:
 *     module.exports            -> Promise<ExpressApp>  (default)
 *     module.exports.getApp     -> () => Promise<ExpressApp>
 *     module.exports.createAgent-> () => Promise<SupertestAgent>
 *
 * Usage in tests (CJS):
 *   const appPromise = require("./helpers/supertestApp");
 *   let app;
 *   beforeAll(async () => { app = await appPromise; });
 *   it("...", async () => { const request = require("supertest"); await request(app).get("/healthcheck"); });
 *
 * Usage in tests (ESM/Babel):
 *   import appPromise, { getApp, createAgent } from "./helpers/supertestApp";
 *   const app = await getApp(); // or: const app = await appPromise;
 *   const agent = await createAgent();
 */

const request = require("supertest");

// Load the Express app through the CJS bridge (returns a Promise<ExpressApp>)
const appPromise = require("../../app.cjs");

// Helpers
async function getApp() {
  return appPromise;
}

async function createAgent() {
  const app = await getApp();
  return request(app);
}

// Default export = Promise<ExpressApp>
// Also expose named helpers for convenience.
module.exports = appPromise;
module.exports.getApp = getApp;
module.exports.createAgent = createAgent;
// --- REPLACE END ---
