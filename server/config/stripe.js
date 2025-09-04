// File: server/config/stripe.js
// Centralized Stripe client configuration

import Stripe from 'stripe';

// --- REPLACE START: create a single reusable Stripe client with resiliency ---
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is not defined in environment variables.');
  throw new Error('Missing STRIPE_SECRET_KEY for Stripe initialization');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Lock API version for stability across environments
  apiVersion: '2024-06-20',
  // Improve resiliency against transient network errors
  maxNetworkRetries: 2,
  timeout: 20000, // 20s request timeout
});
// --- REPLACE END ---

export default stripe;
