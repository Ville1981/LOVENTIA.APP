// --- REPLACE START: convert ESM to CommonJS; keep logic intact ---
'use strict';

/**
 * Middleware that logs an estimated request cost.
 * Keep the same API and behavior, just convert to CommonJS.
 */
const { getApiRequestCost } = require('./costCalculator.js');

function costLogger(req, res, next) {
  const cost = getApiRequestCost(req);
  console.info(`Request cost estimated: $${cost.toFixed(5)}`);
  next();
}

module.exports = { costLogger };
// --- REPLACE END ---
