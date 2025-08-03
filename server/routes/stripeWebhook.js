// server/routes/stripeWebhook.js

// --- REPLACE START: convert CommonJS to ES modules and export default router ---
import express from 'express';
import Stripe from 'stripe';
import 'dotenv/config';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

/**
 * POST /api/payment/stripe-webhook
 * Receives Stripe webhook events and handles subscription status
 */
router.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        // Subscription created successfully
        console.log('Checkout session completed:', event.data.object.id);
        break;
      case 'invoice.paid':
        console.log('Invoice paid:', event.data.object.id);
        break;
      case 'invoice.payment_failed':
        console.warn('Invoice payment failed:', event.data.object.id);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.sendStatus(200);
  }
);

// --- REPLACE END ---

export default router;
