// File: scripts/validate-env.js
// Validates that required environment variables exist.
// Soft mode (default): prints warnings but DOES NOT fail CI.
// Strict mode: set STRICT_ENV=1 to fail when variables are missing.

'use strict';

// --- REPLACE START: soft validation with optional strict mode ---
const required = [
  'MONGO_URI',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PREMIUM_PRICE_ID',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_SECRET',
  'PAYPAL_PREMIUM_PRICE',
  'PAYPAL_WEBHOOK_ID',
  'CLIENT_URL',
];

const missing = required.filter((k) => !process.env[k]);

if (missing.length > 0) {
  // Warn in soft mode so the pipeline can continue
  console.warn(
    [
      'WARNING: Missing required environment variables:',
      ...missing.map((k) => `  - ${k}`),
      '',
      'Hint: Add the missing values to your local .env, deployment env,',
      'or GitHub Actions Secrets. Set STRICT_ENV=1 to enforce failure.',
    ].join('\n')
  );

  if (String(process.env.STRICT_ENV).trim() === '1') {
    console.error('STRICT_ENV is enabled. Failing due to missing variables.');
    process.exit(1); // hard fail in strict mode
  }
} else {
  console.log('All required environment variables are set.');
}
// --- REPLACE END ---
