// --- REPLACE START: centralized CORS config ---
'use strict';

const cors = require('cors');

// Whitelisted origins — add or adjust domains for staging/production as needed
const whitelist = [
  process.env.CLIENT_URL || 'http://localhost:5174',
  'https://loventia.app',
  'https://www.loventia.app'
];

/**
 * Centralized CORS options.
 * - Restricts access to whitelisted origins
 * - Allows server-to-server or curl/mobile requests with no origin
 * - Sends proper preflight (OPTIONS) responses
 * - Enables credentials for cookie-based authentication
 */
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (e.g. server-to-server, CLI tools)
    if (!origin || whitelist.includes(origin)) {
      return callback(null, true);
    }
    // Block if origin not in whitelist
    callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true, // Allow cookies/credentials to be sent
  optionsSuccessStatus: 204 // For legacy browser support
};

// Export configured CORS middleware
module.exports = cors(corsOptions);
// --- REPLACE END ---
