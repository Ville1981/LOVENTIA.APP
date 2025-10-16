// PATH: server/src/config/env.js

import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: process.env.MONGO_URI || process.env.DATABASE_URL || '',

  // Keep legacy client origin keys for compatibility
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || '',

  // --- REPLACE START: forward CORS_ORIGINS (CSV) and expose a parsed list ---
  /**
   * CORS_ORIGINS can be a comma-separated list, e.g.
   *   CORS_ORIGINS=http://localhost:5173,http://localhost:5174
   * We keep both the raw string and a parsed array for consumers.
   */
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',
  CORS_ORIGIN_LIST:
    (process.env.CORS_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  // Optional: expose WEB_ORIGIN if some parts of the app still read it
  WEB_ORIGIN: process.env.WEB_ORIGIN || '',
  // --- REPLACE END ---

  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  ENABLE_MORGAN: (process.env.ENABLE_MORGAN || 'true') === 'true',
};
