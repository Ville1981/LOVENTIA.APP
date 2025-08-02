#!/usr/bin/env node

// scripts/validate-env.js
// Validates that all required environment variables are set before running the app.

// List all required environment variables here:
const requiredEnvVars = [
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

const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `\n❌  Missing required environment variables:\n   ${missing
      .map((k) => `- ${k}`)
      .join('\n')}\n`
  );
  process.exit(1);
}

console.log('✅  All required environment variables are set.');
