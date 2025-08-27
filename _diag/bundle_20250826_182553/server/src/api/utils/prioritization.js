// --- REPLACE START: convert ESM to CommonJS; keep logic intact ---
'use strict';

/**
 * Calculates priority score with impact × effort model
 * @param {number} impact     User feedback impact (1-10)
 * @param {number} effort     Estimated work effort (1-10)
 * @returns {number}          Priority score
 */
function calculatePriority(impact, effort) {
  if (effort <= 0) return Infinity; // avoid division by zero
  return impact / effort;
}

module.exports = { calculatePriority };
// --- REPLACE END ---
