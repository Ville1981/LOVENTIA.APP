// File: server/src/app.cjs

// --- REPLACE START: CommonJS bridge for tests ---
// This tiny CJS bridge lets tools/tests `require("server/src/app.cjs")`
// and get the Express app synchronously without touching ESM loaders.
/* eslint-disable */
const app = require('./app.js');
module.exports = app;
// --- REPLACE END ---
