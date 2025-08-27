// File: server/routes/stripeWebhook.js

// --- REPLACE START: Robust Stripe webhook (verify + sync from Stripe + premium consistency) ---
import express from 'express';
import Stripe from 'stripe';
import 'dotenv/config';

import User from '../models/User.js';

const router = express.Router();

// Keep one API version across the app
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

/**
 * Helper: update user premium flags by userId. Optionally persist customerId.
 * Tries to stay backward compatible by updating both `isPremium` and `premium`.
 */
async function setUserPremiumById(userId, value, stripeCustomerId = null) {
  if (!userId) return false;
  const update = {
    isPremium: !!value,
    premium: !!value,
  };
  if (stripeCustomerId) update.stripeCustomerId = stripeCustomerId;

  const res = await User.findByIdAndUpdate(userId, update, { new: true }).exec();
  console.log(`[webhook] setUserPremiumById: user=${userId} → ${!!value}`);
  return !!res;
}

/**
 * Helper: update user premium flags by stripeCustomerId.
 */
async function setUserPremiumByCustomerId(customerId, value) {
  if (!customerId) return false;
  const res = await User.findOneAndUpdate(
    { stripeCustomerId: customerId },
    { isPremium: !!value, premium: !!value },
    { new: true }
  ).exec();
  console.log(`[webhook] setUserPremiumByCustomerId: customer=${customerId} → ${!!value}`);
  return !!res;
}

/**
 * Helper: ensure both flags match (covers legacy mismatches).
 * NOTE: We keep this as a guard, but the *authoritative* source is Stripe (see sync below).
 */
async function ensurePremiumConsistencyByCustomerId(customerId) {
  if (!customerId) return false;
  const doc = await User.findOne({ stripeCustomerId: customerId })
    .select('_id isPremium premium')
    .lean()
    .exec();
  if (!doc) return false;

  const currentIsPremium = !!doc.isPremium;
  const currentPremium = !!doc.premium;
  if (currentIsPremium === currentPremium) return true;

  // If the flags diverge, keep the "truthy" one. Stripe sync will correct shortly after.
  const target = currentIsPremium || currentPremium;
  await User.findByIdAndUpdate(doc._id, { isPremium: target, premium: target }, { new: true });
  console.log(`[webhook] ensured consistency for user=${doc._id} → ${target}`);
  return true;
}

/**
 * Authoritative sync from Stripe.
 * If the customer has >0 active/trialing subscriptions → premium=true else false.
 * Uses status: 'all' and filters locally to avoid multi-sub edge cases.
 */
async function syncPremiumFromStripe(customerId) {
  if (!customerId) return;

  // Fetch ALL statuses, then filter to active states we care about
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });

  const allSubs = Array.isArray(subs?.data) ? subs.data : [];
  const activeSubs = allSubs.filter(
    (s) => s?.status === 'active' || s?.status === 'trialing'
  );

  const activeCount = activeSubs.length;
  const target = activeCount > 0;

  await setUserPremiumByCustomerId(customerId, target);
  await ensurePremiumConsistencyByCustomerId(customerId);

  console.log(
    `[webhook] syncPremiumFromStripe → customer=${customerId} has ${activeCount} active/trialing subscriptions → isPremium=${target}`
  );
}

/**
 * Resolve app userId from checkout session
 * Priority: metadata.userId → (fallback) lookup by session.customer
 */
async function resolveUserFromCheckoutSession(session) {
  const metaUserId = session?.metadata?.userId || null;
  if (metaUserId) return { userId: metaUserId, customerId: session?.customer || null };

  const customerId = session?.customer || null;
  if (!customerId) return { userId: null, customerId: null };

  const u = await User.findOne({ stripeCustomerId: customerId }).select('_id').lean().exec();
  return { userId: u?._id?.toString() || null, customerId };
}

/**
 * STRIPE WEBHOOK ENDPOINT
 *
 * NOTE: The router is mounted in server/index.js like:
 *   app.use('/api/payment/stripe-webhook', stripeWebhookRouter);
 *
 * Therefore we define the route here at '/' (not '/stripe-webhook'), so the final URL is:
 *   POST /api/payment/stripe-webhook
 */
router.post(
  '/',
  // Webhook requires the raw body for signature verification
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[webhook] Missing STRIPE_WEBHOOK_SECRET — cannot verify webhooks.');
      return res.status(500).send('Stripe webhook is not configured on the server.');
    }

    const signature = req.headers['stripe-signature'];
    let event;

    try {
      // IMPORTANT: req.body is a Buffer because of express.raw above
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err?.message || err);
      return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
    }

    try {
      console.log(`[webhook] received event: ${event.type}`);

      switch (event.type) {
        /**
         * A user successfully completed Checkout for a subscription.
         * We mark them premium and persist the Stripe customer id, then sync from Stripe for safety.
         */
        case 'checkout.session.completed': {
          const session = event.data.object;
          const customerId = session?.customer || null;

          const { userId } = await resolveUserFromCheckoutSession(session);
          if (userId) await setUserPremiumById(userId, true, customerId);
          else if (customerId) await setUserPremiumByCustomerId(customerId, true);

          if (customerId) await syncPremiumFromStripe(customerId);
          break;
        }

        /**
         * Subscription created/updated/deleted → always re-sync from Stripe.
         * This ensures premium reflects the existence of ANY active/trialing sub.
         */
        case 'customer.subscription.created': {
          const subscription = event.data.object;
          const customerId = subscription?.customer || null;
          if (customerId) await syncPremiumFromStripe(customerId);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const customerId = subscription?.customer || null;
          if (customerId) await syncPremiumFromStripe(customerId);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription?.customer || null;
          if (customerId) await syncPremiumFromStripe(customerId);
          break;
        }

        /**
         * Payment success can revive an otherwise past_due subscription.
         * We still sync from Stripe to maintain a single source of truth.
         */
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const customerId = invoice?.customer || null;
          if (customerId) await syncPremiumFromStripe(customerId);
          break;
        }

        /**
         * Optional: log failures for visibility.
         */
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          console.warn('[webhook] invoice.payment_failed:', invoice?.id);
          break;
        }

        default: {
          console.log(`[webhook] Unhandled event: ${event.type}`);
        }
      }

      // Acknowledge receipt
      return res.sendStatus(200);
    } catch (err) {
      // Do not crash webhook; log and ack (or return 500 if you want Stripe retries)
      console.error(`[webhook] Error processing ${event.type}:`, err);
      return res.sendStatus(200);
    }
  }
);

export default router;
// --- REPLACE END ---