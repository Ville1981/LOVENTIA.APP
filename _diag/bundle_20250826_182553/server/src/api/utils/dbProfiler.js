// --- REPLACE START: convert ESM to CommonJS; keep logic intact ---
'use strict';

const { performance } = require('perf_hooks');
const db = require('../db'); // your DB client import

/**
 * Executes a query and profiles its duration
 * @param {string} query SQL query
 * @param {Array<any>} params Params
 */
async function executeWithProfiling(query, params = []) {
  const start = performance.now();
  const result = await db.query(query, params);
  const duration = performance.now() - start;
  if (duration > 200) { // threshold millis
    console.warn(`Slow query (${duration.toFixed(2)} ms): ${query}`);
  }
  return result;
}

module.exports = { executeWithProfiling };
// --- REPLACE END ---
