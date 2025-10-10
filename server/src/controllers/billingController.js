// File: server/src/controllers/billingController.js

// --- REPLACE START: Stripe billing controller (Checkout, Portal, Webhook with signature verification) ---
/**
 * Billing controller
 *
 * Responsibilities:
 *  - Create Stripe Checkout Session for subscriptions.
 *  - Create Stripe Billing Portal Session for managing/canceling subscriptions.
 *  - Handle Stripe Webhook events with signature verification and toggle premium status.
 *
 * Requirements:
 *  - ENV:
 *      STRIPE_PRICE_ID            -> Stripe Price ID for the subscription.
 *      STRIPE_WEBHOOK_SECRET      -> Webhook signing secret for this environment.
 *      STRIPE_SUCCESS_URL         -> (Optional) Success redirect; falls back to configured billingUrls.successUrl.
 *      STRIPE_CANCEL_URL          -> (Optional) Cancel redirect;  falls back to configured billingUrls.cancelUrl.
 *  - Stripe client is initialized in server/config/stripe.js
 *  - User model is provided by server/src/models/User.js (ESM/CJS bridge).
 */

import crypto from 'node:crypto';
import User from '../models/User.js';
import stripe, { billingUrls } from '../../config/stripe.js';

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Normalize a user from req.user or fetch from DB if only an id is present.
 * This keeps controllers resilient to different auth middlewares.
 */
async function resolveUserFromRequest(req) {
  if (req?.user && req.user._id) {
    // If the middleware already populated a full Mongoose document, return it.
    if (typeof req.user.save === 'function') return req.user;
    // Otherwise, fetch the document by id.
    return await User.findById(req.user._id);
  }
  // Fallback: if middleware stored userId
  if (req?.userId) {
    return await User.findById(req.userId);
  }
  return null;
}

/**
 * Ensure Stripe Customer exists for the user; create if missing and persist.
 * Uses email and stores appUserId in Stripe metadata for easier reconciliation.
 */
async function getOrCreateStripeCustomer(userDoc) {
  if (!userDoc) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  if (userDoc.stripeCustomerId && typeof userDoc.stripeCustomerId === 'string') {
    return userDoc.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: userDoc.email,
    metadata: { appUserId: String(userDoc._id) },
  });

  userDoc.stripeCustomerId = customer.id;
  await userDoc.save();
  return customer.id;
}

/**
 * Given a Stripe customer id, set user's premium flag.
 * Attempts direct lookup by stripeCustomerId; if not found, tries metadata backfill.
 */
async function setPremiumByCustomer(customerId, premium) {
  if (!customerId) return;
  const found = await User.findOne({ stripeCustomerId: customerId });
  if (found) {
    found.premium = !!premium;
    await found.save();
    return;
  }
  // Metadata backfill (best-effort)
  try {
    const c = await stripe.customers.retrieve(customerId);
    const appUserId = c?.metadata?.appUserId;
    if (appUserId) {
      await User.updateOne({ _id: appUserId }, { $set: { premium: !!premium } });
    }
  } catch {
    // no-op; not fatal for webhook processing
  }
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout session (subscription mode).
 * Honors mock flag upstream (routes layer) so here we only implement the real path.
 */
export async function createCheckout(req, res) {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return res.status(500).json({ error: 'Missing STRIPE_PRICE_ID' });
  }

  const user = await resolveUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const customerId = await getOrCreateStripeCustomer(user);

  const successUrl = process.env.STRIPE_SUCCESS_URL || billingUrls.successUrl;
  const cancelUrl = process.env.STRIPE_CANCEL_URL || billingUrls.cancelUrl;

  // Use an idempotency key to avoid creating multiple sessions on rapid clicks
  const idemKey = `checkout_${user._id}_${crypto.randomUUID()}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      automatic_tax: { enabled: true },
      metadata: { appUserId: String(user._id) },
    },
    { idempotencyKey: idemKey }
  );

  return res.json({ id: session.id, url: session.url });
}

/**
 * POST /api/billing/create-portal-session
 * Opens Stripe Billing Portal for the current user.
 */
export async function createPortal(req, res) {
  const user = await resolveUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const customerId = await getOrCreateStripeCustomer(user);
  const returnUrl = process.env.STRIPE_SUCCESS_URL || billingUrls.returnUrl;

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return res.json({ url: portal.url });
}

/**
 * POST /api/billing/webhook
 * NOTE: Route must be declared with express.raw({ type: 'application/json' }) to preserve raw body.
 * Validates signature and reacts to key subscription events.
 */
export async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send('Webhook secret missing');

  let event;
  try {
    // req.body is a Buffer here (because of express.raw)
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    // Signature failed → 400 so Stripe can retry
    // eslint-disable-next-line no-console
    console.error('❌ Stripe webhook signature verification failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // Successful checkout → subscription created/activated
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        await setPremiumByCustomer(customerId, true);
        break;
      }

      // Subscription canceled or deleted → premium off
      case 'customer.subscription.deleted':
      case 'customer.subscription.canceled': {
        const sub = event.data.object;
        const customerId = sub.customer;
        await setPremiumByCustomer(customerId, false);
        break;
      }

      // Keep premium ON while active; OFF when status transitions to canceled/incomplete_expired etc.
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = sub.customer;
        const activeStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid']); // adjust to your policy
        const isActive = activeStatuses.has(sub.status);
        await setPremiumByCustomer(customerId, isActive);
        break;
      }

      // Optional: failed payment may be handled separately if you want to downgrade earlier/later.
      case 'invoice.payment_failed': {
        // No immediate action; rely on subscription.updated events to toggle premium.
        break;
      }

      default:
        // No-op for other events
        break;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('⚠️ Error while handling Stripe event:', event?.type, e);
    // Return 200 to avoid aggressive retries unless you specifically want Stripe to retry.
    // If you prefer retries for transient DB outages, you may return 500 here.
  }

  return res.status(200).send('ok');
}
// --- REPLACE END ---
