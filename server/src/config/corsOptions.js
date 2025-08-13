// --- REPLACE START: centralized CORS config ---
'use strict';

const cors = require('cors');

// Allowed origins — extend this array for staging/production
const whitelist = [
  process.env.CLIENT_URL || 'http://localhost:5174',
  'https://loventia.app',
  'https://www.loventia.app'
];

/**
 * Centralized CORS options.
 * - Allows whitelisted origins
 * - Sends proper preflight (OPTIONS) responses
 * - Enables credentials for cookie-based auth
 */
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin || whitelist.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};

// Export configured middleware
module.exports = cors(corsOptions);
// --- REPLACE END ---
