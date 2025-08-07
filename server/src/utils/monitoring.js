// server/src/utils/monitoring.js

// --- REPLACE START: Import dependencies and helper ---
const Sentry = require('@sentry/node');
const winston = require('winston');
const { checkThreshold } = require('./alertRules');
// --- REPLACE END ---

// Environment variables
const {
  SENTRY_DSN,
  NODE_ENV,
  ERROR_RATE_THRESHOLD,
  LATENCY_THRESHOLD_MS,
  THROUGHPUT_THRESHOLD_RPM
} = process.env;

// Initialize Sentry
Sentry.init({
  dsn: SENTRY_DSN,
  environment: NODE_ENV,
  tracesSampleRate: 1.0,
});

// Configure Winston logger
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    // Add file or other transports if needed
  ],
});

/**
 * Monitor and log error rate.
 * @param {number} errorCount - Number of errors in the period.
 * @param {number} totalCount - Total number of requests in the period.
 */
async function monitorErrorRate(errorCount, totalCount) {
  const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;
  logger.warn(`Error rate: ${errorRate.toFixed(2)}%`);
  // --- REPLACE START: Threshold check for error rate ---
  await checkThreshold(
    'Error Rate',
    errorRate,
    Number(ERROR_RATE_THRESHOLD)
  );
  // --- REPLACE END ---
}

/**
 * Monitor and log average latency.
 * @param {number} latencyMs - Measured latency in milliseconds.
 */
async function monitorLatency(latencyMs) {
  logger.info(`Latency: ${latencyMs} ms`);
  // --- REPLACE START: Threshold check for latency ---
  await checkThreshold(
    'Latency',
    latencyMs,
    Number(LATENCY_THRESHOLD_MS)
  );
  // --- REPLACE END ---
}

/**
 * Monitor and log throughput.
 * @param {number} requestsPerMinute - Requests per minute.
 */
async function monitorThroughput(requestsPerMinute) {
  logger.info(`Throughput: ${requestsPerMinute} req/min`);
  // --- REPLACE START: Threshold check for throughput ---
  await checkThreshold(
    'Throughput',
    requestsPerMinute,
    Number(THROUGHPUT_THRESHOLD_RPM)
  );
  // --- REPLACE END ---
}

module.exports = {
  Sentry,
  logger,
  monitorErrorRate,
  monitorLatency,
  monitorThroughput,
};