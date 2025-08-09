// --- REPLACE START: centralized CORS config ---
'use strict';

const cors = require('cors');

// Allowed origins — extend this array for production domains
const whitelist = [
  process.env.CLIENT_URL || 'http://localhost:5174',
  // 'https://your-production-domain.com',
];

/**
 * CORS options object.
 */
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (e.g. curl, mobile apps)
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
