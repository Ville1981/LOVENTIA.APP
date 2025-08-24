// File: server/routes/stripeWebhook.js

// --- REPLACE START: Robust Stripe webhook (signature verify + premium on/off + customer mapping) ---
import express from 'express';
import Stripe from 'stripe';
import 'dotenv/config';

import User from '../models/User.js';

const router = express.Router();

// Use the same API version everywhere in the project for consistency
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

/**
 * Helper: update user's premium status and, if provided, persist stripeCustomerId.
 * Tries to be backward compatible by touching both `isPremium` and (if present) `premium`.
 */
async function setUserPremiumById(userId, value, stripeCustomerId = null) {
  if (!userId) return false;
  const update = {
    isPremium: !!value,
    premium: !!value, // in case older schema/code reads `premium`
  };
  if (stripeCustomerId) update.stripeCustomerId = stripeCustomerId;

  const u = await User.findByIdAndUpdate(userId, update, { new: true }).exec();
  return !!u;
}

/**
 * Helper: find a user by Stripe customer id and set premium.
 */
async function setUserPremiumByCustomerId(customerId, value) {
  if (!customerId) return false;
  const u = await User.findOneAndUpdate(
    { stripeCustomerId: customerId },
    { isPremium: !!value, premium: !!value },
    { new: true }
  ).exec();
  return !!u;
}

/**
 * Helper: resolve app user id from a checkout session event.
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
      console.error('Missing STRIPE_WEBHOOK_SECRET — cannot verify webhooks.');
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
      console.error('Stripe webhook signature verification failed:', err?.message || err);
      return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
    }

    try {
      switch (event.type) {
        /**
         * A user successfully completed Checkout for a subscription.
         * We mark them premium and persist the Stripe customer id for future events.
         */
        case 'checkout.session.completed': {
          const session = event.data.object;
          const customerId = session?.customer || null;

          // Try to resolve app user id from metadata or by customer lookup
          const { userId } = await resolveUserFromCheckoutSession(session);

          if (userId) {
            await setUserPremiumById(userId, true, customerId);
            // You can also persist the subscription id if you need it later:
            // const subscriptionId = session?.subscription || null;
          } else if (customerId) {
            // No userId in metadata; try mapping by customer only
            await setUserPremiumByCustomerId(customerId, true);
          } else {
            console.warn('checkout.session.completed with no userId and no customerId');
          }
          break;
        }

        /**
         * Recurring invoices were paid. Optional: keep a breadcrumb, ensure premium remains true.
         */
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const customerId = invoice?.customer || null;
          if (customerId) {
            await setUserPremiumByCustomerId(customerId, true);
          }
          break;
        }

        /**
         * Subscription canceled or ended. Turn off premium.
         * This event can also arrive as `customer.subscription.deleted`.
         */
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription?.customer || null;
          if (customerId) {
            await setUserPremiumByCustomerId(customerId, false);
          }
          break;
        }

        /**
         * Optional: handle payment failures.
         */
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          console.warn('Stripe invoice payment failed:', invoice?.id);
          // You might choose to notify the user via email/notification here.
          break;
        }

        default: {
          // Keep logs lean; comment this out if it gets noisy.
          console.log(`Unhandled Stripe event type: ${event.type}`);
        }
      }

      // Acknowledge receipt
      return res.sendStatus(200);
    } catch (err) {
      // Never crash the webhook; log and return 200 or 500 depending on severity.
      console.error(`Error processing Stripe event ${event.type}:`, err);
      return res.sendStatus(500);
    }
  }
);

export default router;
// --- REPLACE END ---
