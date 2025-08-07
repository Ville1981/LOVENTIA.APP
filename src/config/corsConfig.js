// server/src/config/corsConfig.js

/**
 * Centralized CORS configuration middleware.
 * Allows only whitelisted origins to interact with the API.
 */
const cors = require('cors');

// --- REPLACE START: define allowed origins ---
const whitelist = [
  process.env.CLIENT_URL || 'http://localhost:5174',  // Vite dev server
  // 'https://loventia.app',                           // production URL, set via CLIENT_URL
];
// --- REPLACE END ---

// --- REPLACE START: configure CORS options ---
const corsOptions = {
  origin(origin, callback) {
    // allow requests with no origin (e.g. mobile apps, curl)
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};
// --- REPLACE END ---

module.exports = cors(corsOptions);
