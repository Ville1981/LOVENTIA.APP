// server/src/middleware/metricsMiddleware.js

// --- REPLACE START: Import monitoring functions ---
const {
  monitorErrorRate,
  monitorLatency,
  monitorThroughput
} = require('../utils/monitoring');
// --- REPLACE END ---

// In-memory counters for throughput and errors
let requestCount = 0;
let errorCount = 0;

// Reset counters every minute for throughput calculation
setInterval(() => {
  const rpm = requestCount;
  monitorThroughput(rpm).catch(err => console.error('Throughput monitor failed:', err));
  requestCount = 0;
  errorCount = 0;
}, 60 * 1000);

/**
 * Express middleware to measure latency, error rate, and throughput.
 */
function metricsMiddleware(req, res, next) {
  const start = process.hrtime();
  requestCount++;

  res.on('finish', () => {
    const [sec, nanosec] = process.hrtime(start);
    const latencyMs = sec * 1000 + nanosec / 1e6;
    monitorLatency(latencyMs).catch(err => console.error('Latency monitor failed:', err));

    if (res.statusCode >= 500) {
      errorCount++;
    }

    const total = requestCount || 1;
    monitorErrorRate(errorCount, total).catch(err => console.error('Error rate monitor failed:', err));
  });

  next();
}

module.exports = metricsMiddleware;