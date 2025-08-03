// server/routes/stripeWebhook.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const Subscription = require('../models/Subscription');

// Tämä reitti käyttää express.raw, joten rekisteröi se ennen express.json()-parseria
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Käsitellään vain checkout.session.completed -tapahtuma
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata.userId;
      try {
        await Subscription.findOneAndUpdate(
          { user: userId },
          {
            plan: 'premium',
            status: 'active',
            startedAt: new Date(),
            endsAt: null
          },
          { upsert: true, new: true }
        );
        console.log(`Subscription updated for user ${userId}`);
      } catch (error) {
        console.error('Error updating subscription:', error);
      }
    } else {
      console.log(`Unhandled stripe event type ${event.type}`);
    }

    res.json({ received: true });
  }
);

module.exports = router;
