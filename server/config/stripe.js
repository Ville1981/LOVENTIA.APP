// File: server/config/stripe.js
// Centralized Stripe client configuration

import Stripe from 'stripe';

// --- REPLACE START: create a single reusable Stripe client with resiliency ---
// Validate presence of the secret key early to avoid silent misconfigurations.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY || typeof STRIPE_SECRET_KEY !== 'string' || !STRIPE_SECRET_KEY.trim()) {
  // Do not print the key; just a clear error for operators.
  console.error('❌ STRIPE_SECRET_KEY is not defined or empty in environment variables.');
  throw new Error('Missing STRIPE_SECRET_KEY for Stripe initialization');
}

// Optional sanity check: Stripe test/secret keys typically start with "sk_".
if (!/^sk_/.test(STRIPE_SECRET_KEY)) {
  console.warn('⚠️ STRIPE_SECRET_KEY does not look like a valid secret key (expected to start with "sk_"). Proceeding anyway.');
}

// Create a single, reusable Stripe client instance.
// NOTE: Keep apiVersion pinned for stability across environments.
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  // Improve resiliency against transient network errors/timeouts.
  maxNetworkRetries: 2,
  timeout: 20000, // 20s request timeout
});

// Provide unified fallback URLs for portal/checkout flows.
// These can be overridden via ENV without code changes.
export const billingUrls = Object.freeze({
  returnUrl:
    process.env.BILLING_RETURN_URL ??
    'http://localhost:5174/settings/subscriptions',
  successUrl:
    process.env.CHECKOUT_SUCCESS_URL ??
    'http://localhost:5174/settings/subscriptions?status=success',
  cancelUrl:
    process.env.CHECKOUT_CANCEL_URL ??
    'http://localhost:5174/settings/subscriptions?status=cancel',
});
// --- REPLACE END ---

export default stripe;
