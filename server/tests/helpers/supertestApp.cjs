// File: server/tests/helpers/supertestApp.cjs

// --- REPLACE START ---
/**
 * Supertest helper (CommonJS)
 * Loads the in-memory Express app synchronously and exports it for tests.
 *
 * Why:
 * - Ensures Supertest receives a real Express instance (fixes "app.address is not a function")
 * - Avoids ESM/CJS pitfalls by sticking to require() only
 * - Does NOT start an HTTP server (app.js already skips listen() in NODE_ENV='test')
 *
 * Usage in tests:
 *   const request = require('supertest');
 *   const app = require('./helpers/supertestApp.cjs');
 *   await request(app).get('/healthcheck').expect(200);
 */

'use strict';

const path = require('path');

// Make sure we're in test mode before requiring the app entry.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Candidate entry files for the Express app (CJS-friendly first)
const CANDIDATES = [
  path.resolve(__dirname, '../../app.js'),
  path.resolve(__dirname, '../../src/app.js'),
  path.resolve(__dirname, '../../index.js'),
];

function tryRequire(p) {
  try {
    // Will throw if not resolvable
    require.resolve(p);
    // Load module; prefer default export if present
    const mod = require(p);
    return mod && (mod.default || mod.app || mod);
  } catch (_e) {
    return null;
  }
}

let app = null;
let lastTried = null;

for (const candidate of CANDIDATES) {
  lastTried = candidate;
  const loaded = tryRequire(candidate);
  if (loaded && typeof loaded === 'function' && typeof loaded.use === 'function') {
    app = loaded;
    break;
  }
}

// Basic validation: Supertest expects an Express app (a function with .use)
if (!app || typeof app.use !== 'function') {
  const tried = CANDIDATES.join(', ');
  throw new Error(
    `supertestApp.cjs could not load an Express app. Tried: ${tried}. ` +
    `Last candidate: ${lastTried}`
  );
}

// Export the Express instance for Supertest
module.exports = app;
// --- REPLACE END ---
