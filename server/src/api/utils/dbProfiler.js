// src/utils/dbProfiler.js

import { performance } from 'perf_hooks';
import db from '../db'; // your DB client import

/**
 * Suorittaa kyselyn ja profiloi sen keston
 * @param {string} query SQL-kysely
 * @param {Array<any>} params Parametrit
 */
export async function executeWithProfiling(query, params = []) {
  const start = performance.now();
  const result = await db.query(query, params);
  const duration = performance.now() - start;
  if (duration > 200) {
    // threshold millis
    console.warn(`Slow query (${duration.toFixed(2)} ms): ${query}`);
  }
  return result;
}
