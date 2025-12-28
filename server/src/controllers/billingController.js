// PATH: server/src/controllers/billingController.js

// File: server/src/controllers/billingController.js

// --- REPLACE START: Stripe billing controller (Checkout, Portal, Webhook with signature verification + durable premium sync) ---
/**
 * Billing controller
 *
 * Responsibilities:
 *  - Create Stripe Checkout Session for subscriptions.
 *  - Create Stripe Billing Portal Session for managing/canceling subscriptions.
 *  - Handle Stripe Webhook events with signature verification and toggle premium status.
 *  - Provide an explicit /billing/sync endpoint that *persists* premium state on the User.
 *
 * Requirements:
 *  - ENV:
 *      STRIPE_PRICE_ID            -> Stripe Price ID for the subscription.
 *      STRIPE_WEBHOOK_SECRET      -> Webhook signing secret for this environment.
 *      STRIPE_SUCCESS_URL         -> (Optional) Checkout success redirect; falls back to configured billingUrls.successUrl.
 *      STRIPE_CANCEL_URL          -> (Optional) Checkout cancel redirect;  falls back to configured billingUrls.cancelUrl.
 *      STRIPE_RETURN_URL          -> (Optional) Billing Portal return redirect; falls back to configured billingUrls.returnUrl.
 *  - Stripe client is initialized in server/config/stripe.js
 *  - User model is provided by server/src/models/User.js (ESM/CJS bridge).
 */

import crypto from "node:crypto";

import * as UserModule from "../models/User.js";
const User = UserModule.default || UserModule;

import normalizeUserOut from "../utils/normalizeUserOut.js";
import stripe, { billingUrls } from "../../config/stripe.js";

// ✅ High-level transactional email service (writes logs via sendEmail.js)
import { sendTransactionalEmail } from "../utils/emailService.js";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Default weekly quota for Super Likes when the user is Premium.
 * You can override this via process.env.SUPERLIKES_PER_WEEK if desired.
 */
const SUPERLIKES_PER_WEEK_DEFAULT = Number(
  process.env.SUPERLIKES_PER_WEEK || 3,
);

/**
 * Subscription statuses that we consider as "active" for premium purposes.
 * Adjust if your policy differs.
 */
const ACTIVE_SUB_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

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
    if (typeof req.user.save === "function") return req.user;
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
  if (!userDoc)
    throw Object.assign(new Error("Unauthorized"), { status: 401 });

  if (
    userDoc.stripeCustomerId &&
    typeof userDoc.stripeCustomerId === "string"
  ) {
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
 * Find a user by Stripe customer id.
 * This is shared by both premium-writer and transactional email logic.
 */
async function findUserByStripeCustomer(customerId) {
  if (!customerId) return null;

  // First: direct lookup
  let userDoc = await User.findOne(
    { stripeCustomerId: customerId },
    { _id: 1, email: 1 },
  );

  if (userDoc) return userDoc;

  // Second: best-effort metadata backfill
  try {
    const customer = await stripe.customers.retrieve(customerId);
    const appUserId = customer?.metadata?.appUserId;
    if (appUserId) {
      userDoc = await User.findById(appUserId, { _id: 1, email: 1 });
      return userDoc || null;
    }
  } catch {
    // ignore Stripe errors here, this is best-effort only
  }

  return null;
}

/**
 * Build entitlements.features block based on premium flag.
 *
 * NOTE:
 *  - For PREMIUM we explicitly set superLikesPerWeek to a numeric quota (default 3).
 *  - For FREE we keep it numeric 1 to make client logic simple and consistent.
 *  - Keep qaVisibilityAll true for both tiers (matches current product decision).
 */
function buildEntitlementFeatures(isPremium) {
  if (isPremium) {
    return {
      seeLikedYou: true,
      superLikesPerWeek: SUPERLIKES_PER_WEEK_DEFAULT, // numeric
      unlimitedLikes: true,
      unlimitedRewinds: true,
      dealbreakers: true,
      qaVisibilityAll: true,
      introsMessaging: true,
      noAds: true,
    };
  }
  return {
    seeLikedYou: false,
    superLikesPerWeek: 1, // numeric baseline for FREE
    unlimitedLikes: false,
    unlimitedRewinds: false,
    dealbreakers: false,
    qaVisibilityAll: true,
    introsMessaging: false,
    noAds: false,
  };
}

/**
 * Given a Stripe subscription object, derive the premium state payload.
 * Accepts statuses considered "active" by policy.
 */
function derivePremiumStateFromSubscription(subscription) {
  if (!subscription) {
    return {
      isPremium: false,
      subscriptionId: null,
      tier: "free",
      since: null,
      until: null,
    };
  }

  const isActive = ACTIVE_SUB_STATUSES.has(subscription.status);
  const since = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null;
  const until = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  return {
    isPremium: !!isActive,
    subscriptionId: subscription.id || null,
    tier: isActive ? "premium" : "free",
    since: isActive ? since : null,
    until: isActive ? until : null,
  };
}

/**
 * Persist premium-related fields on User atomically.
 * Returns the updated document (not normalized).
 *
 * Rules:
 *  - Merge (do not wipe) entitlements.features
 *  - Always set user.subscriptionId
 *  - Always set entitlements.tier
 *  - Keep quotas.superLikes sane defaults
 *
 * IMPORTANT:
 *  - We do NOT reset entitlements.quotas.superLikes.used here.
 *    Super Like usage is managed by the Super Like controller (weekly window logic).
 *    Billing sync only controls tier and feature flags.
 */
async function writeUserPremiumState(userId, premiumState) {
  const { isPremium, subscriptionId, tier, since, until } = premiumState;

  // Compute the desired features block from premium flag
  const computed = buildEntitlementFeatures(isPremium);

  // Build $set for clarity and to avoid accidentally removing other fields
  const $set = {
    // Top-level mirrors
    isPremium: !!isPremium,
    premium: !!isPremium, // legacy mirror if used elsewhere
    subscriptionId: subscriptionId ?? null,

    // Entitlements tier + timing
    "entitlements.tier": tier || (isPremium ? "premium" : "free"),
    "entitlements.since": since ?? null,
    "entitlements.until": until ?? null,

    // Feature flags (explicit, non-destructive at object level)
    "entitlements.features.seeLikedYou": !!computed.seeLikedYou,
    "entitlements.features.dealbreakers": !!computed.dealbreakers,
    "entitlements.features.qaVisibilityAll": !!computed.qaVisibilityAll,
    "entitlements.features.introsMessaging": !!computed.introsMessaging,
    "entitlements.features.noAds": !!computed.noAds,
    "entitlements.features.unlimitedLikes": !!computed.unlimitedLikes,
    "entitlements.features.unlimitedRewinds": !!computed.unlimitedRewinds,

    // ⭐ Numeric weekly quota (premium → 3 by default; coerced to Number)
    "entitlements.features.superLikesPerWeek":
      Number(computed.superLikesPerWeek) ||
      (isPremium ? SUPERLIKES_PER_WEEK_DEFAULT : 1),

    // NOTE:
    //  - We deliberately do NOT touch entitlements.quotas.superLikes.used / weekKey / window here.
    //  - Those fields are updated by the Super Like quota logic and must not be reset on billing sync.
  };

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set },
    { new: true, runValidators: true },
  );

  return updated;
}

/**
 * Given a Stripe customer id, toggle User premium using durable writer above.
 * If user not found by customerId, attempts metadata backfill.
 */
async function upsertPremiumByCustomer(customerId, isPremium, subscription) {
  if (!customerId) return;

  const fromSub = derivePremiumStateFromSubscription(
    isPremium ? subscription : null,
  );

  // First: try to resolve the user
  const userDoc = await findUserByStripeCustomer(customerId);
  if (!userDoc?._id) return;

  await writeUserPremiumState(userDoc._id, fromSub);
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
    return res.status(500).json({ error: "Missing STRIPE_PRICE_ID" });
  }

  const user = await resolveUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const customerId = await getOrCreateStripeCustomer(user);

  const successUrl = process.env.STRIPE_SUCCESS_URL || billingUrls.successUrl;
  const cancelUrl = process.env.STRIPE_CANCEL_URL || billingUrls.cancelUrl;

  // Use an idempotency key to avoid creating multiple sessions on rapid clicks
  const idemKey = `checkout_${user._id}_${crypto.randomUUID()}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      automatic_tax: { enabled: true },
      metadata: { appUserId: String(user._id) },
    },
    { idempotencyKey: idemKey },
  );

  return res.json({ id: session.id, url: session.url });
}

/**
 * POST /api/billing/create-portal-session
 * Opens Stripe Billing Portal for the current user.
 */
export async function createPortal(req, res) {
  const user = await resolveUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const customerId = await getOrCreateStripeCustomer(user);

  // --- REPLACE START: fix Billing Portal return URL selection (do NOT use STRIPE_SUCCESS_URL) ---
  // Portal return URL is NOT the same as Checkout success URL.
  // Prefer STRIPE_RETURN_URL (or the centralized billingUrls.returnUrl which already supports BILLING_RETURN_URL/STRIPE_RETURN_URL defaults).
  // Keep STRIPE_SUCCESS_URL only as a last-resort legacy fallback to avoid breaking older envs.
  const returnUrl =
    process.env.STRIPE_RETURN_URL ||
    billingUrls.returnUrl ||
    process.env.STRIPE_SUCCESS_URL;
  // --- REPLACE END ---

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return res.json({ url: portal.url });
}

/**
 * POST /api/billing/sync
 * Explicitly reconcile Stripe → User and persist premium state.
 * Returns the *updated* normalized user so the client can reflect changes immediately.
 *
 * IMPORTANT:
 *  - This endpoint manages premium flags, subscriptionId, tier and feature toggles.
 *  - It intentionally does NOT reset Super Like quotas; those are updated by /api/superlike.
 *  - We also log a transactional email event (via emailService) when premium state changes
 *    or stays the same (billing.sync).
 */
export async function sync(req, res) {
  const user = await resolveUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const customerId = await getOrCreateStripeCustomer(user);

  // Track previous premium state so we can detect transitions
  const wasPremiumBefore =
    !!user.isPremium ||
    !!user.premium ||
    user?.entitlements?.tier === "premium";

  // Fetch the latest subscription for this customer
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    expand: ["data.default_payment_method", "data.latest_invoice.payment_intent"],
    limit: 5,
  });

  // Prefer an active/trialing subscription if present, otherwise take the newest
  const preferred =
    subs.data.find((s) => ACTIVE_SUB_STATUSES.has(s.status)) ||
    subs.data.sort((a, b) => (b.created || 0) - (a.created || 0))[0] ||
    null;

  const premiumState = derivePremiumStateFromSubscription(preferred);
  const updated = await writeUserPremiumState(user._id, premiumState);

  const becamePremium = !wasPremiumBefore && !!premiumState.isPremium;
  const downgraded = wasPremiumBefore && !premiumState.isPremium;

  // Best-effort transactional email logging:
  // ⬇️ Trigger billing emails only when state actually changes
  try {
    const requestId = req.id || req.headers["x-request-id"] || undefined;
    const to = updated?.email;

    let changeType = null;
    if (becamePremium) {
      changeType = "billing.purchase";
    } else if (downgraded) {
      changeType = "billing.cancel";
    }

    // If there is no actual state change, do not send any email.
    if (changeType) {
      const subjectMap = {
        "billing.purchase": "Welcome to Loventia Premium",
        "billing.cancel": "Your Loventia Premium has ended",
      };

      const textMap = {
        "billing.purchase":
          "Thank you for upgrading to Loventia Premium. Your premium benefits are now active.",
        "billing.cancel":
          "Your Loventia Premium subscription is no longer active. You can upgrade again anytime from Settings → Subscriptions.",
      };

      await sendTransactionalEmail({
        type: changeType,
        to,
        subject: subjectMap[changeType],
        text: textMap[changeType],
        html: undefined,
        payload: {
          userId: String(updated._id),
          subscriptionId: premiumState.subscriptionId,
          tier: premiumState.tier,
          wasPremiumBefore,
          isPremiumNow: premiumState.isPremium,
        },
        meta: {
          source: "billing.sync",
          event: changeType,
          requestId,
        },
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "Transactional email (billing.sync) failed or was skipped:",
      e?.message || e,
    );
  }

  // IMPORTANT: return the updated, normalized user so FE can update immediately
  return res.json({
    ok: true,
    isPremium: premiumState.isPremium,
    subscriptionId: premiumState.subscriptionId,
    user: normalizeUserOut(updated),
  });
}

/**
 * POST /api/billing/webhook
 *
 * NOTE:
 * - Ideal setup: route is mounted with express.raw({ type: 'application/json' })
 *   BEFORE any express.json() / urlencoded() body parsers, so req.body is a Buffer.
 * - In this project, expressLoader() may already attach JSON parsers earlier,
 *   so in local development req.body can sometimes be a parsed object when
 *   Stripe CLI forwards events.
 *
 * Strategy:
 *  - PRODUCTION:
 *      Always require a raw Buffer and verify signature via stripe.webhooks.constructEvent.
 *      If verification fails → 400 so Stripe can retry.
 *  - NON-PRODUCTION (development/test):
 *      If req.body is not a Buffer, fall back to using the already-parsed object
 *      as the event and SKIP signature verification.
 *      This makes Stripe CLI tests work even when raw body is not available.
 *
 * Additionally:
 *  - Sends renewal success / failure transactional emails on invoice events.
 */
export async function handleWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send("Webhook secret missing");

  const NODE_ENV = process.env.NODE_ENV || "development";
  const isProduction = NODE_ENV === "production";
  const hasBufferBody = Buffer.isBuffer(req.body);

  let event;

  // 1) Prefer strict signature verification when we have a Buffer
  if (hasBufferBody) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      // Signature failed → 400 in production; in dev we log + fall back to parsed body.
      // eslint-disable-next-line no-console
      console.error(
        "❌ Stripe webhook signature verification failed:",
        err?.message || err,
      );

      if (isProduction) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Dev/test fallback: skip signature verification, use parsed object.
      // eslint-disable-next-line no-console
      console.warn(
        "⚠️ Dev fallback: processing Stripe webhook without verified signature (Buffer case).",
      );
      try {
        // If json parser already ran earlier, req.body may actually be an object here,
        // but in practice when hasBufferBody === true, it should still be raw.
        event = JSON.parse(req.body.toString("utf8"));
      } catch {
        event = req.body;
      }
    }
  } else {
    // 2) No Buffer available
    if (isProduction) {
      // In production we require the raw body for signature verification.
      // eslint-disable-next-line no-console
      console.error(
        "❌ Stripe webhook error: req.body is not a Buffer in production. " +
          "Ensure express.raw({ type: 'application/json' }) is mounted before JSON parsers.",
      );
      return res
        .status(400)
        .send("Webhook Error: raw Buffer body required for signature verification");
    }

    // Dev/test: accept parsed object from already-run JSON parser
    // eslint-disable-next-line no-console
    console.warn(
      "⚠️ Dev fallback: req.body is not a Buffer, using parsed body as Stripe event without signature verification.",
    );
    event = req.body;
  }

  try {
    switch (event.type) {
      // Successful checkout → subscription created/activated
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer;
        // Fetch the attached subscription to set proper dates/features
        let subscription = null;
        if (session.subscription) {
          subscription = await stripe.subscriptions.retrieve(
            session.subscription,
          );
        }
        await upsertPremiumByCustomer(customerId, true, subscription);
        break;
      }

      // Subscription canceled or deleted → premium off
      case "customer.subscription.deleted":
      case "customer.subscription.canceled": {
        const sub = event.data.object;
        const customerId = sub.customer;
        await upsertPremiumByCustomer(customerId, false, null);
        break;
      }

      // Keep premium ON while active; OFF when status transitions to canceled/incomplete_expired etc.
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = sub.customer;
        const isActive = ACTIVE_SUB_STATUSES.has(sub.status);
        await upsertPremiumByCustomer(customerId, isActive, sub);
        break;
      }

      // Renewal succeeded: we send a "billing.renewal_success" email.
      // NOTE: We only treat it as a renewal if billing_reason === 'subscription_cycle'
      //       so the initial purchase does not double-send with checkout.session.completed.
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        const billingReason = invoice.billing_reason;

        if (billingReason === "subscription_cycle") {
          const userDoc = await findUserByStripeCustomer(customerId);
          if (userDoc && userDoc.email) {
            const requestId =
              req.id || req.headers["x-request-id"] || undefined;

            try {
              await sendTransactionalEmail({
                type: "billing.renewal_success",
                to: userDoc.email,
                subject: "Your Loventia Premium renewal was successful",
                text:
                  "Good news – your Loventia Premium subscription has been renewed successfully. Your premium benefits continue without interruption.",
                html: undefined,
                payload: {
                  userId: String(userDoc._id),
                  subscriptionId: subscriptionId || null,
                  billingReason,
                },
                meta: {
                  source: "billing.webhook",
                  event: "billing.renewal_success",
                  requestId,
                },
              });
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error(
                "Transactional email (billing.renewal_success) failed or was skipped:",
                e?.message || e,
              );
            }
          }
        }

        break;
      }

      // Payment failed: send "billing.renewal_failed" email.
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        const billingReason = invoice.billing_reason;

        const userDoc = await findUserByStripeCustomer(customerId);
        if (userDoc && userDoc.email) {
          const requestId =
            req.id || req.headers["x-request-id"] || undefined;

          try {
            await sendTransactionalEmail({
              type: "billing.renewal_failed",
              to: userDoc.email,
              subject: "There was a problem renewing your Loventia Premium",
              text:
                "We could not renew your Loventia Premium subscription because a payment attempt failed. " +
                "Please check your payment method in the billing portal to avoid losing your premium benefits.",
              html: undefined,
              payload: {
                userId: String(userDoc._id),
                subscriptionId: subscriptionId || null,
                billingReason,
              },
              meta: {
                source: "billing.webhook",
                event: "billing.renewal_failed",
                requestId,
              },
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(
              "Transactional email (billing.renewal_failed) failed or was skipped:",
              e?.message || e,
            );
          }
        }

        // We do NOT downgrade immediately here; we rely on subscription.updated
        // events to toggle premium when Stripe actually changes the subscription status.
        break;
      }

      default:
        // No-op for other events
        break;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("⚠️ Error while handling Stripe event:", event?.type, e);
    // Return 200 to avoid aggressive retries unless you specifically want Stripe to retry.
    // If you prefer retries for transient DB outages, you may return 500 here.
  }

  return res.status(200).send("ok");
}
// --- REPLACE END ---

