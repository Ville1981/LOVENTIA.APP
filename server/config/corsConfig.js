// File: server/src/config/corsConfig.js
// Centralized CORS configuration middleware
// The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed

// --- REPLACE START: centralized CORS config ---
const cors = require('cors');

// Define your allowed origins.
// Extend this array with production domains as needed.
const whitelist = [
  process.env.CLIENT_URL || 'http://localhost:5174',
  // 'https://your-production-domain.com',
];

/**
 * CORS options object.
 * - origin: only allow requests from whitelist (or no origin)
 * - methods: allowed HTTP methods
 * - allowedHeaders: headers client may send
 * - exposedHeaders: headers client may read
 * - credentials: allow cookies/auth headers
 * - optionsSuccessStatus: response status for preflight
 */
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin || whitelist.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

// Export the configured middleware
module.exports = cors(corsOptions);
// --- REPLACE END ---
