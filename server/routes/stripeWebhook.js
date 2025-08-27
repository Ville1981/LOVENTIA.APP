// File: server/routes/stripeWebhook.js

// --- REPLACE START: Robust Stripe webhook (verify + sync from Stripe + premium consistency) ---
'use strict';

/**
 * Stripe Webhook Router (ESM)
 * - Verifies signatures using STRIPE_WEBHOOK_SECRET
 * - Syncs premium flags (isPremium & premium) and subscriptionId with Stripe as the source of truth
 * - Exports `export default router` for compatibility with ESM `index.js`
 */

import express from 'express';
import Stripe from 'stripe';
import 'dotenv/config';

import User from '../models/User.js';

const router = express.Router();

// Use the same Stripe API version as in your CLI logs for deterministic behavior
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────────── */

/**
 * Update user premium flags by userId. Optionally set stripeCustomerId and subscriptionId.
 * Keeps backward compatibility by writing both `isPremium` and `premium`.
 */
async function setUserPremiumById(userId, value, stripeCustomerId = null, subscriptionId = null) {
  if (!userId) return false;
  const update = {
    isPremium: !!value,
    premium: !!value,
  };
  if (stripeCustomerId) update.stripeCustomerId = stripeCustomerId;
  if (subscriptionId)   update.subscriptionId   = subscriptionId;

  const res = await User.findByIdAndUpdate(userId, update, { new: true }).exec();
  console.log(
    `[webhook] setUserPremiumById: user=${userId} → ${!!value}` +
    (stripeCustomerId ? ` (customer=${stripeCustomerId})` : '') +
    (subscriptionId   ? ` (sub=${subscriptionId})` : '')
  );
  return !!res;
}

/**
 * Update user premium flags by stripeCustomerId. Optionally set/unset subscriptionId.
 * Pass subscriptionId=null to $unset it; pass undefined to leave it unchanged.
 */
async function setUserPremiumByCustomerId(customerId, value, subscriptionId = undefined) {
  if (!customerId) return false;

  const update = { isPremium: !!value, premium: !!value };
  if (subscriptionId !== undefined) {
    if (subscriptionId === null) update.$unset = { subscriptionId: '' };
    else update.subscriptionId = subscriptionId;
  }

  const res = await User.findOneAndUpdate(
    { stripeCustomerId: customerId },
    update,
    { new: true }
  ).exec();

  console.log(
    `[webhook] setUserPremiumByCustomerId: customer=${customerId} → ${!!value}` +
    (subscriptionId === undefined ? '' :
      (subscriptionId === null ? ' (unset subId)' : ` (sub=${subscriptionId})`))
  );
  return !!res;
}

/**
 * Set (or unset) subscriptionId by customerId without touching premium flags.
 */
async function setSubscriptionIdByCustomerId(customerId, subscriptionId) {
  if (!customerId) return false;

  if (subscriptionId === null) {
    await User.findOneAndUpdate(
      { stripeCustomerId: customerId },
      { $unset: { subscriptionId: '' } },
      { new: true }
    ).exec();
    console.log(`[webhook] unset subscriptionId for customer=${customerId}`);
    return true;
  }

  const res = await User.findOneAndUpdate(
    { stripeCustomerId: customerId },
    { subscriptionId },
    { new: true }
  ).exec();

  console.log(`[webhook] set subscriptionId=${subscriptionId} for customer=${customerId}`);
  return !!res;
}

/**
 * Ensure legacy flags (`isPremium` and `premium`) match for a given customer.
 * Useful when older code may have toggled only one of them.
 */
async function ensurePremiumConsistencyByCustomerId(customerId) {
  if (!customerId) return false;
  const doc = await User.findOne({ stripeCustomerId: customerId })
    .select('_id isPremium premium')
    .lean()
    .exec();

  if (!doc) return false;

  const a = !!doc.isPremium;
  const b = !!doc.premium;
  if (a === b) return true;

  const target = a || b;
  await User.findByIdAndUpdate(doc._id, { isPremium: target, premium: target }, { new: true }).exec();
  console.log(`[webhook] ensured consistency for user=${doc._id} → ${target}`);
  return true;
}

/**
 * Authoritative sync from Stripe:
 * - If any subscription is active/trialing → premium=true, else false
 * - Persists the newest active/trialing subscriptionId (by created), or unsets when none
 */
async function syncPremiumFromStripe(customerId) {
  if (!customerId) return;

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',    // list everything, decide locally
    limit: 100,
  });

  const all = Array.isArray(subs?.data) ? subs.data : [];
  const activeTrial = all.filter((s) => s?.status === 'active' || s?.status === 'trialing');

  const target = activeTrial.length > 0;

  // Choose latest active/trialing by created timestamp
  let latestActiveSubId = null;
  if (activeTrial.length > 0) {
    latestActiveSubId = activeTrial.slice().sort((a, b) => (b.created || 0) - (a.created || 0))[0]?.id || null;
  }

  await setUserPremiumByCustomerId(customerId, target, latestActiveSubId ?? null);
  await ensurePremiumConsistencyByCustomerId(customerId);

  console.log(
    `[webhook] syncPremiumFromStripe: customer=${customerId} ` +
    `activeCount=${activeTrial.length} → isPremium=${target}, ` +
    `subscriptionId=${latestActiveSubId || 'null'}`
  );
}

/**
 * Resolve app userId from a Checkout Session:
 * Priority: session.metadata.userId → fallback: lookup by session.customer ↔ User.stripeCustomerId
 */
async function resolveUserFromCheckoutSession(session) {
  const metaUserId = session?.metadata?.userId || null;
  if (metaUserId) {
    return { userId: metaUserId, customerId: session?.customer || null };
  }

  const customerId = session?.customer || null;
  if (!customerId) return { userId: null, customerId: null };

  const u = await User.findOne({ stripeCustomerId: customerId })
    .select('_id')
    .lean()
    .exec();

  return { userId: u?._id?.toString() || null, customerId };
}

/* ──────────────────────────────────────────────────────────────────────────────
   Webhook Endpoint
   Mounted by app as: app.use('/api/payment/stripe-webhook', router)
   → So define POST '/' here.
────────────────────────────────────────────────────────────────────────────── */
router.post(
  '/',
  // IMPORTANT: raw body is required for signature verification
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[webhook] Missing STRIPE_WEBHOOK_SECRET — cannot verify webhooks.');
      return res.status(500).send('Stripe webhook is not configured on the server.');
    }

    const signature = req.headers['stripe-signature'];
    let event;

    try {
      // req.body is a Buffer here (because of express.raw)
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
         * After a successful subscription checkout:
         * - Store customerId / subscriptionId and set premium=true
         * - Then perform a full sync to be authoritative
         */
        case 'checkout.session.completed': {
          const session = event.data.object;
          const customerId    = session?.customer || null;
          const subscriptionId = session?.subscription || null;

          const { userId } = await resolveUserFromCheckoutSession(session);

          if (userId) {
            await setUserPremiumById(userId, true, customerId, subscriptionId || undefined);
          } else if (customerId) {
            await setUserPremiumByCustomerId(customerId, true);
          }

          if (customerId) {
            if (subscriptionId) await setSubscriptionIdByCustomerId(customerId, subscriptionId);
            await syncPremiumFromStripe(customerId);
          }
          break;
        }

        /**
         * Subscription lifecycle → always re-sync to Stripe state.
         */
        case 'customer.subscription.created': {
          const sub = event.data.object;
          const customerId = sub?.customer || null;
          const subId      = sub?.id || null;

          if (customerId && subId) await setSubscriptionIdByCustomerId(customerId, subId);
          if (customerId)          await syncPremiumFromStripe(customerId);
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const customerId = sub?.customer || null;
          const subId      = sub?.id || null;

          if (customerId && subId) await setSubscriptionIdByCustomerId(customerId, subId);
          if (customerId)          await syncPremiumFromStripe(customerId);
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const customerId = sub?.customer || null;

          if (customerId) {
            await setSubscriptionIdByCustomerId(customerId, null); // unset
            await syncPremiumFromStripe(customerId);                // → will mark premium=false if no actives
          }
          break;
        }

        /**
         * Invoice paid can transition an otherwise past_due subscription back to good standing.
         * Keep source of truth as Stripe by re-syncing.
         */
        case 'invoice.payment_succeeded': {
          const invoice    = event.data.object;
          const customerId = invoice?.customer || null;

          if (customerId) await syncPremiumFromStripe(customerId);
          break;
        }

        /**
         * Optional visibility for failures
         */
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          console.warn('[webhook] invoice.payment_failed:', invoice?.id);
          break;
        }

        default: {
          // Keep log but do not fail
          console.log(`[webhook] Unhandled event: ${event.type}`);
        }
      }

      // Acknowledge receipt
      return res.sendStatus(200);

    } catch (err) {
      // Do not crash webhook; log and acknowledge to avoid endless retries unless you want them
      console.error(`[webhook] Error processing ${event?.type || 'event'}:`, err);
      return res.sendStatus(200);
    }
  }
);

export default router;
// --- REPLACE END ---
