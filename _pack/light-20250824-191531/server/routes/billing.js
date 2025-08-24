// File: server/routes/billing.js

// --- REPLACE START: New billing routes (Stripe Checkout & Billing Portal) ---
import express from 'express';
import 'dotenv/config';
import Stripe from 'stripe';

import authenticateToken from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// --- Stripe setup & env guards ---
const {
  STRIPE_SECRET_KEY,
  STRIPE_PREMIUM_PRICE_ID,
  CLIENT_URL,
  STRIPE_BILLING_PORTAL_RETURN_URL,
} = process.env;

const stripe =
  STRIPE_SECRET_KEY
    ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
    : null;

/**
 * Helper: build absolute URL with safe fallback.
 */
function appUrl(path = '') {
  const base = CLIENT_URL || 'http://localhost:5174';
  const suffix = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${base}${suffix}`;
}

/**
 * Helper: ensure Stripe is configured, otherwise respond 501 (Not Implemented)
 */
function requireStripeConfigured(res) {
  if (!stripe || !STRIPE_SECRET_KEY) {
    res
      .status(501)
      .json({
        error:
          'Stripe is not configured on the server. Set STRIPE_SECRET_KEY and restart the server.',
      });
    return false;
  }
  if (!STRIPE_PREMIUM_PRICE_ID) {
    res
      .status(501)
      .json({
        error:
          'Missing STRIPE_PREMIUM_PRICE_ID in environment. Create a recurring product/price in Stripe and set this env var.',
      });
    return false;
  }
  return true;
}

/**
 * Helper: create a Stripe customer if the user does not have one yet.
 * Saves the stripeCustomerId back to the user document.
 */
async function ensureStripeCustomer(user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      appUserId: String(user._id),
      appUsername: user.username || '',
    },
  });

  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout Session (subscription mode) and returns { url }
 *
 * Body (optional):
 *   { email?: string }  // will only be used if the user has no email set
 *
 * Notes:
 *  - We attach metadata.userId so the webhook can map the session back to the user.
 *  - success_url/cancel_url point back to /settings/subscriptions.
 */
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    if (!requireStripeConfigured(res)) return;

    const userId = req.userId;
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).json({ error: 'User not found for checkout.' });
    }

    // Ensure the user has (or gets) a Stripe customer
    const customerId = await ensureStripeCustomer(user);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // IMPORTANT: set your recurring price id here (env)
      line_items: [
        {
          price: STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      // Help your webhook map back to the app user
      metadata: {
        userId: String(user._id),
        username: user.username || '',
      },
      // Where to send the user after success/cancel
      success_url: appUrl('/settings/subscriptions') + '?success=1&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: appUrl('/settings/subscriptions') + '?canceled=1',
    });

    return res.json({ url: session.url });
  } catch (err) {
    // Avoid leaking internals; log server-side, respond generic
    console.error('Stripe checkout session error:', err);
    return res
      .status(500)
      .json({ error: 'Unable to create checkout session at the moment.' });
  }
});

/**
 * POST /api/billing/create-portal-session
 * Creates a Stripe Billing Portal session for the current user and returns { url }
 *
 * Notes:
 *  - If the user has no stripeCustomerId, we create a customer first (so Portal can open).
 *  - Return URL defaults to /settings/subscriptions unless STRIPE_BILLING_PORTAL_RETURN_URL is set.
 */
router.post('/create-portal-session', authenticateToken, async (req, res) => {
  try {
    if (!requireStripeConfigured(res)) return;

    const userId = req.userId;
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).json({ error: 'User not found for billing portal.' });
    }

    const customerId = await ensureStripeCustomer(user);
    const returnUrl = STRIPE_BILLING_PORTAL_RETURN_URL || appUrl('/settings/subscriptions');

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.json({ url: portal.url });
  } catch (err) {
    console.error('Stripe billing portal error:', err);
    return res
      .status(500)
      .json({ error: 'Unable to open billing portal at the moment.' });
  }
});

export default router;
// --- REPLACE END ---
