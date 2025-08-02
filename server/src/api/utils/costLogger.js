// src/utils/costLogger.js

/**
 * Middleware, joka kirjaa pyyntöjen kustannusarvion lokiin
 */
import { getApiRequestCost } from './costCalculator';

export function costLogger(req, res, next) {
  const cost = getApiRequestCost(req);
  console.info(`Request cost estimated: $${cost.toFixed(5)}`);
  next();
}
