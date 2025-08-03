// scripts/validate-env.js
// Validates that all required environment variables are set before starting the application.

// List all required keys here:
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

// Check for missing variables:
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  // Exit with failure code so CI or start scripts stop
  process.exit(1);
}

console.log('All required environment variables are set.');
