// --- REPLACE START: unified, de-duplicated admin routes with safe controller fallback ---
// This file consolidates admin endpoints and adds a resilient fallback if
// ../controllers/adminController.js is missing. It keeps previous behavior,
// avoids duplicate imports, and guards everything with authenticate + requireAdmin.

import express from 'express';
import mongoose from 'mongoose';

// Auth / role guards
import authenticate from '../middleware/authenticate.js';
import requireAdmin from '../middleware/requireAdmin.js';
// Keep roleAuthorization import available if you later want extra role checks.
// Not used directly here to avoid double-guarding.
import roleAuthorization from '../middleware/roleAuthorization.js'; // eslint-disable-line no-unused-vars

// Models used by CSV exports
import User from '../models/User.js';
import Match from '../models/Match.js';

// CSV helper
import { Parser as Json2CsvParser } from 'json2csv';

const router = express.Router();

/* ────────────────────────────────────────────────────────────────────────────
 * Resolve admin controllers (getMetrics, getStripeRevenue)
 * - Prefer importing from ../controllers/adminController.js
 * - If the module is not present, provide safe inline fallbacks so the app runs.
 * ────────────────────────────────────────────────────────────────────────────
 */
let getMetrics;
let getStripeRevenue;

try {
  // Prefer ESM import of the official controller module
  const mod = await import('../controllers/adminController.js');
  // Support both named and default exports
  getMetrics = mod.getMetrics || mod.default?.getMetrics;
  getStripeRevenue = mod.getStripeRevenue || mod.default?.getStripeRevenue;
} catch (_e) {
  // Fallbacks are minimal and dependency-free, suitable until the real controller is added.
  const startedAt = Date.now();

  getMetrics = async (_req, res) => {
    try {
      const mongoState = mongoose.connection?.readyState ?? 0;
      // Safe counts without failing if collections are missing
      const Users = mongoose.connection.collections?.users;
      const Messages = mongoose.connection.collections?.messages;

      const [userCount, messageCount] = await Promise.all([
        Users?.countDocuments?.({}) ?? 0,
        Messages?.countDocuments?.({}) ?? 0,
      ]);

      const payload = {
        ok: true,
        ts: Date.now(),
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        mongo: {
          readyState: mongoState, // 0=disconnected,1=connected,2=connecting,3=disconnecting
        },
        totals: {
          users: userCount,
          messages: messageCount,
        },
      };
      return res.status(200).json(payload);
    } catch (err) {
      console.error('[admin fallback getMetrics] error:', err?.message || err);
      return res.status(500).json({ error: 'Server Error' });
    }
  };

  // Stripe revenue fallback:
  // If you store Stripe invoice/checkout events in `billing_events`,
  // we attempt a best-effort sum based on last 30 days of paid invoices.
  getStripeRevenue = async (req, res) => {
    try {
      const BillingEvents = mongoose.connection.collection('billing_events');
      if (!BillingEvents) {
        return res.status(200).json({ revenueLast30d: 0, currency: 'usd', note: 'billing_events collection not found' });
      }

      // Collect recent invoice.payment_succeeded events (adjust window as needed)
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const cursor = BillingEvents.find({
        type: 'invoice.payment_succeeded',
        created: { $gte: Math.floor(since.getTime() / 1000) },
      }).sort({ _id: -1 }).limit(100000);

      let sum = 0;
      let currency = 'usd';

      // NOTE: Stripe amounts are usually in cents. We convert to standard units.
      // We try a few common paths: event.raw.dataObject.amount_paid, .total, .amount_total
      // and fall back to 0 if not found.
      // If multiple currencies exist, the "currency" value will be the last seen one.
      // Adjust this logic to your schema as needed.
      // eslint-disable-next-line no-await-in-loop
      for await (const ev of cursor) {
        const obj = ev?.raw?.dataObject || {};
        const cents =
          typeof obj.amount_paid === 'number' ? obj.amount_paid
            : typeof obj.total === 'number' ? obj.total
              : typeof obj.amount_total === 'number' ? obj.amount_total
                : 0;
        if (typeof obj.currency === 'string') currency = obj.currency;
        sum += cents / 100;
      }

      return res.status(200).json({
        revenueLast30d: Number(sum.toFixed(2)),
        currency,
        source: 'billing_events (fallback)',
      });
    } catch (err) {
      console.error('[admin fallback getStripeRevenue] error:', err?.message || err);
      return res.status(500).json({ error: 'Server Error' });
    }
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin-only metrics and Stripe revenue
 * ────────────────────────────────────────────────────────────────────────────
 * Guard with authenticate + requireAdmin to ensure only admins can access.
 */
router.get('/metrics', authenticate, requireAdmin, getMetrics);
router.get('/stripe/revenue', authenticate, requireAdmin, getStripeRevenue);

/* ────────────────────────────────────────────────────────────────────────────
 * CSV: Users
 * ────────────────────────────────────────────────────────────────────────────
 * Exports a normalized subset of fields. Adjust projections as needed.
 */
router.get('/export/users.csv', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find(
      {},
      {
        email: 1,
        createdAt: 1,
        updatedAt: 1,
        lastLoginAt: 1, // if present
        isPremium: 1,
        premium: 1,
        likesGiven: 1,      // if present
        likesReceived: 1,   // if present
        matchesCount: 1,    // if present
      }
    ).lean();

    const rows = (users || []).map((u) => ({
      id: String(u._id),
      email: u.email ?? '',
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
      updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : '',
      lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : '',
      isPremium: !!u.isPremium,
      premiumTier: u?.premium?.tier ?? '',
      premiumActive: u?.premium?.active ?? false,
      likesGiven: u?.likesGiven ?? 0,
      likesReceived: u?.likesReceived ?? 0,
      matchesCount: u?.matchesCount ?? 0,
    }));

    const fields =
      Object.keys(rows[0] ?? {
        id: '',
        email: '',
        createdAt: '',
        updatedAt: '',
        lastLoginAt: '',
        isPremium: '',
        premiumTier: '',
        premiumActive: '',
        likesGiven: '',
        likesReceived: '',
        matchesCount: '',
      });

    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="users_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin export users.csv]', err);
    return res.status(500).json({ error: 'Server Error' });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * CSV: Matches
 * ────────────────────────────────────────────────────────────────────────────
 */
router.get('/export/matches.csv', authenticate, requireAdmin, async (req, res) => {
  try {
    const docs = await Match.find(
      {},
      {
        users: 1,           // [userAId, userBId]
        createdAt: 1,
        updatedAt: 1,
        lastMessageAt: 1,   // if present
        status: 1,          // active/blocked/…
      }
    ).lean();

    const rows = (docs || []).map((m) => ({
      id: String(m._id),
      userA: String(m.users?.[0] ?? ''),
      userB: String(m.users?.[1] ?? ''),
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : '',
      updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : '',
      lastMessageAt: m.lastMessageAt ? new Date(m.lastMessageAt).toISOString() : '',
      status: m.status ?? 'active',
    }));

    const fields =
      Object.keys(rows[0] ?? {
        id: '',
        userA: '',
        userB: '',
        createdAt: '',
        updatedAt: '',
        lastMessageAt: '',
        status: '',
      });

    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="matches_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin export matches.csv]', err);
    return res.status(500).json({ error: 'Server Error' });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * CSV: Billing events (from raw Mongo collection `billing_events`)
 * ────────────────────────────────────────────────────────────────────────────
 */
router.get('/export/billing-events.csv', authenticate, requireAdmin, async (req, res) => {
  try {
    const BillingEvents = mongoose.connection.collection('billing_events');
    const docs = await BillingEvents.find({}).sort({ _id: -1 }).limit(10000).toArray();

    const rows = (docs || []).map((d) => ({
      id: String(d._id),
      type: d.type ?? '',
      eventId: d.id ?? '',
      createdAt: d.created ? new Date(d.created).toISOString() : '',
      stripeObjectId: d.raw?.dataObject?.id ?? '',
      customer: d.raw?.dataObject?.customer ?? '',
      subscription: d.raw?.dataObject?.subscription ?? '',
      status: d.raw?.dataObject?.status ?? '',
      email: d.raw?.dataObject?.email ?? '',
    }));

    const fields =
      Object.keys(rows[0] ?? {
        id: '',
        type: '',
        eventId: '',
        createdAt: '',
        stripeObjectId: '',
        customer: '',
        subscription: '',
        status: '',
        email: '',
      });

    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="billing-events_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin export billing-events.csv]', err);
    return res.status(500).json({ error: 'Server Error' });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * CSV: Messages (flat list)
 * Optional query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50000
 * ────────────────────────────────────────────────────────────────────────────
 */
router.get('/export/messages.csv', authenticate, requireAdmin, async (req, res) => {
  try {
    const col = mongoose.connection.collection('messages');

    const { from, to, limit } = req.query;
    const q = {};
    if (from || to) {
      q.$and = [];
      if (from)
        q.$and.push({
          $or: [{ createdAt: { $gte: new Date(from) } }, { timestamp: { $gte: new Date(from) } }],
        });
      if (to)
        q.$and.push({
          $or: [{ createdAt: { $lte: new Date(to) } }, { timestamp: { $lte: new Date(to) } }],
        });
      if (!q.$and.length) delete q.$and;
    }

    const cursor = col.find(q).sort({ _id: -1 }).limit(Math.min(Number(limit) || 50000, 200000));
    const docs = await cursor.toArray();

    const norm = (m) => {
      const sender = m.sender ?? m.from ?? m.author ?? m.user ?? m.senderId ?? m.sender?._id ?? null;
      const receiver = m.receiver ?? m.recipient ?? m.to ?? m.receiverId ?? m.receiver?._id ?? null;
      const created = m.createdAt ?? m.timestamp ?? null;
      const text = m.text ?? m.content ?? '';
      const a = sender ? String(sender) : '';
      const b = receiver ? String(receiver) : '';
      const threadKey = a && b ? [a, b].sort().join('__') : '';
      return {
        id: String(m._id),
        threadKey,
        sender: a,
        receiver: b,
        createdAt: created ? new Date(created).toISOString() : '',
        text,
        textLength: (text || '').length,
        matchId: m.match ?? m.matchId ?? '',
      };
    };

    const rows = (docs || []).map(norm);

    const fields =
      Object.keys(rows[0] ?? {
        id: '',
        threadKey: '',
        sender: '',
        receiver: '',
        createdAt: '',
        text: '',
        textLength: '',
        matchId: '',
      });

    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="messages_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin export messages.csv]', err);
    return res.status(500).json({ error: 'Server Error' });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * CSV: Conversations (thread-level summary)
 * Optional query: ?from=ISO&to=ISO&limit=100000
 * ────────────────────────────────────────────────────────────────────────────
 */
router.get('/export/conversations.csv', authenticate, requireAdmin, async (req, res) => {
  try {
    const col = mongoose.connection.collection('messages');

    const { from, to, limit } = req.query;
    const match = {};
    const dateOr = [];
    if (from) dateOr.push({ createdAt: { $gte: new Date(from) } }, { timestamp: { $gte: new Date(from) } });
    if (to) dateOr.push({ createdAt: { $lte: new Date(to) } }, { timestamp: { $lte: new Date(to) } });
    if (dateOr.length) match.$or = dateOr;

    const agg = [
      ...(Object.keys(match).length ? [{ $match: match }] : []),

      // Normalize fields (sender, receiver, createdAt, text)
      {
        $project: {
          _id: 1,
          sender: { $ifNull: ['$sender', { $ifNull: ['$from', { $ifNull: ['$author', '$senderId'] }] }] },
          receiver: { $ifNull: ['$receiver', { $ifNull: ['$recipient', { $ifNull: ['$to', '$receiverId'] }] }] },
          createdAt: { $ifNull: ['$createdAt', '$timestamp'] },
          text: { $ifNull: ['$text', '$content'] },
        },
      },
      // Thread key (a<b)
      {
        $addFields: {
          a: { $cond: [{ $lt: ['$sender', '$receiver'] }, '$sender', '$receiver'] },
          b: { $cond: [{ $lt: ['$sender', '$receiver'] }, '$receiver', '$sender'] },
        },
      },
      {
        $project: {
          threadKey: { $concat: [{ $toString: '$a' }, '__', { $toString: '$b' }] },
          a: { $toString: '$a' },
          b: { $toString: '$b' },
          createdAt: 1,
          text: 1,
          sender: { $toString: '$sender' },
        },
      },
      // Reduce to conversation stats
      { $sort: { createdAt: 1, _id: 1 } },
      {
        $group: {
          _id: '$threadKey',
          userA: { $first: '$a' },
          userB: { $first: '$b' },
          firstMessageAt: { $first: '$createdAt' },
          lastMessageAt: { $last: '$createdAt' },
          messageCount: { $sum: 1 },
          lastMessageText: { $last: '$text' },
          lastSender: { $last: '$sender' },
        },
      },
      { $sort: { lastMessageAt: -1 } },
      { $limit: Math.min(Number(limit) || 100000, 200000) },
    ];

    const docs = await col.aggregate(agg).toArray();

    const rows = (docs || []).map((d) => ({
      threadKey: d._id,
      userA: d.userA,
      userB: d.userB,
      firstMessageAt: d.firstMessageAt ? new Date(d.firstMessageAt).toISOString() : '',
      lastMessageAt: d.lastMessageAt ? new Date(d.lastMessageAt).toISOString() : '',
      messageCount: d.messageCount ?? 0,
      lastSender: d.lastSender ?? '',
      lastMessageText: d.lastMessageText ?? '',
    }));

    const fields =
      Object.keys(rows[0] ?? {
        threadKey: '',
        userA: '',
        userB: '',
        firstMessageAt: '',
        lastMessageAt: '',
        messageCount: '',
        lastSender: '',
        lastMessageText: '',
      });

    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="conversations_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin export conversations.csv]', err);
    return res.status(500).json({ error: 'Server Error' });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * CSV: Billing subscriptions (user premium summary + optional enrichment)
 * ────────────────────────────────────────────────────────────────────────────
 */
router.get('/export/billing-subscriptions.csv', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find(
      {},
      {
        email: 1,
        createdAt: 1,
        updatedAt: 1,
        isPremium: 1,
        premium: 1, // {active, tier, since, canceledAt, currentPeriodEnd, customerId, subscriptionId, ...}
        stripeCustomerId: 1,
      }
    ).lean();

    // Optional enrichment from billing_events
    let lastEventsByCustomer = new Map();
    try {
      if (process.env.STRIPE_LOG_EVENTS === '1') {
        const BillingEvents = mongoose.connection.collection('billing_events');
        const cursor = BillingEvents.aggregate([
          { $match: { 'raw.dataObject.customer': { $exists: true } } },
          { $sort: { _id: -1 } },
          {
            $group: {
              _id: { customer: '$raw.dataObject.customer', subscription: '$raw.dataObject.subscription' },
              type: { $first: '$type' },
              status: { $first: '$raw.dataObject.status' },
              eventId: { $first: '$id' },
              when: { $first: '$created' },
            },
          },
        ]);
        const arr = await cursor.toArray();
        lastEventsByCustomer = new Map(arr.map((e) => [`${e._id.customer}|${e._id.subscription || ''}`, e]));
      }
    } catch (e) {
      console.warn('[billing-subscriptions.csv] enrich skipped:', e?.message);
    }

    const rows = (users || []).map((u) => {
      const prem = u.premium || {};
      const customerId = prem.customerId || u.stripeCustomerId || '';
      const subscriptionId = prem.subscriptionId || '';
      const key = `${customerId}|${subscriptionId}`;
      const enrich = lastEventsByCustomer.get(key);

      const status = prem.active ? 'active' : prem.canceledAt ? 'canceled' : u.isPremium ? 'active' : 'inactive';

      return {
        userId: String(u._id),
        email: u.email ?? '',
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
        updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : '',
        isPremium: !!u.isPremium,
        premiumActive: !!prem.active,
        premiumTier: prem.tier || '',
        premiumSince: prem.since ? new Date(prem.since).toISOString() : '',
        premiumCanceledAt: prem.canceledAt ? new Date(prem.canceledAt).toISOString() : '',
        currentPeriodEnd: prem.currentPeriodEnd ? new Date(prem.currentPeriodEnd).toISOString() : '',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        lastStripeEventType: enrich?.type || '',
        lastStripeEventStatus: enrich?.status || '',
        lastStripeEventAt: enrich?.when ? new Date(enrich.when).toISOString() : '',
        derivedStatus: status,
      };
    });

    const fields =
      Object.keys(rows[0] ?? {
        userId: '',
        email: '',
        createdAt: '',
        updatedAt: '',
        isPremium: '',
        premiumActive: '',
        premiumTier: '',
        premiumSince: '',
        premiumCanceledAt: '',
        currentPeriodEnd: '',
        stripeCustomerId: '',
        stripeSubscriptionId: '',
        lastStripeEventType: '',
        lastStripeEventStatus: '',
        lastStripeEventAt: '',
        derivedStatus: '',
      });

    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="billing-subscriptions_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin export billing-subscriptions.csv]', err);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// Final export
export default router;
// --- REPLACE END ---
