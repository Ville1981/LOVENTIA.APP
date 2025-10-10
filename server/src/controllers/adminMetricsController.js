// File: server/src/controllers/adminMetricsController.js

// --- REPLACE START: minimal metrics aggregation with safe fallbacks ---
import dayjs from "dayjs";

// Lazy imports to avoid startup crashes if any model path changes
let UserModel = null;
let MessageModel = null;
let PaymentModel = null;

async function getModels() {
  if (!UserModel) {
    try {
      const m = await import("../models/User.js");
      UserModel = m.default || m.User || m;
    } catch {
      UserModel = null;
    }
  }
  if (!MessageModel) {
    try {
      const m = await import("../models/Message.js");
      MessageModel = m.default || m.Message || m;
    } catch {
      MessageModel = null;
    }
  }
  if (!PaymentModel) {
    try {
      const m = await import("../models/Payment.js");
      PaymentModel = m.default || m.Payment || m;
    } catch {
      PaymentModel = null;
    }
  }
}

export async function getSummary(req, res) {
  try {
    await getModels();

    // Totals
    const usersTotal = UserModel ? await UserModel.countDocuments({}) : 0;
    const premiumTotal = UserModel ? await UserModel.countDocuments({ $or: [{ isPremium: true }, { premium: true }] }) : 0;

    // Revenue (Month-To-Date) — if you have Stripe charge collection mirrored; otherwise 0 in dev
    let revenueMtd = 0;
    if (PaymentModel) {
      const monthStart = dayjs().startOf("month").toDate();
      const paid = await PaymentModel.aggregate([
        { $match: { status: "succeeded", createdAt: { $gte: monthStart } } },
        { $group: { _id: null, sum: { $sum: "$amount" } } }, // assume amount in USD
      ]);
      revenueMtd = paid?.[0]?.sum || 0;
    }

    // Activity windows
    const now = dayjs();
    const dau = UserModel
      ? await UserModel.countDocuments({ lastActiveAt: { $gte: now.subtract(1, "day").toDate() } })
      : 0;
    const wau = UserModel
      ? await UserModel.countDocuments({ lastActiveAt: { $gte: now.subtract(7, "day").toDate() } })
      : 0;
    const mau = UserModel
      ? await UserModel.countDocuments({ lastActiveAt: { $gte: now.subtract(30, "day").toDate() } })
      : 0;

    // 7-day series (signups & messages)
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      labels.push(dayjs().subtract(i, "day").format("MMM D"));
    }

    let signupsByDay = new Map(labels.map((l) => [l, 0]));
    if (UserModel) {
      const since7 = dayjs().subtract(6, "day").startOf("day").toDate();
      const agg = await UserModel.aggregate([
        { $match: { createdAt: { $gte: since7 } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      ]);
      agg.forEach((g) => {
        const dt = dayjs(`${g._id.y}-${g._id.m}-${g._id.d}`).format("MMM D");
        signupsByDay.set(dt, g.count);
      });
    }

    let msgsByDay = new Map(labels.map((l) => [l, 0]));
    if (MessageModel) {
      const since7 = dayjs().subtract(6, "day").startOf("day").toDate();
      const agg = await MessageModel.aggregate([
        { $match: { createdAt: { $gte: since7 } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      ]);
      agg.forEach((g) => {
        const dt = dayjs(`${g._id.y}-${g._id.m}-${g._id.d}`).format("MMM D");
        msgsByDay.set(dt, g.count);
      });
    }

    const series = {
      signups7d: labels.map((l) => ({ label: l, value: signupsByDay.get(l) || 0 })),
      messages7d: labels.map((l) => ({ label: l, value: msgsByDay.get(l) || 0 })),
    };

    return res.json({
      totals: {
        users: usersTotal,
        premium: premiumTotal,
        revenueMtd,
      },
      activity: { dau, wau, mau },
      series,
    });
  } catch (err) {
    console.error("[adminMetrics] summary failed:", err);
    return res.status(500).json({ error: "Failed to aggregate KPIs." });
  }
}
// --- REPLACE END ---


// File: server/src/controllers/adminController.js

// --- REPLACE START: admin metrics + optional Stripe revenue ---
import 'dotenv/config';

/**
 * NOTE: We lazy-load models to avoid import cycles in some setups.
 */
let UserModel = null;
let MessageModel = null;
let LikeModel = null;

async function models() {
  if (!UserModel) {
    const m = await import('../models/User.js');
    UserModel = m.default || m.User || m;
  }
  if (!MessageModel) {
    try {
      const m = await import('../models/Message.js');
      MessageModel = m.default || m.Message || m;
    } catch {
      MessageModel = null;
    }
  }
  if (!LikeModel) {
    try {
      const m = await import('../models/Like.js');
      LikeModel = m.default || m.Like || m;
    } catch {
      LikeModel = null;
    }
  }
  return { UserModel, MessageModel, LikeModel };
}

/**
 * GET /api/admin/metrics
 * Returns a small KPI set for the dashboard.
 * Query:
 *  - since=<ISO>  (optional; default: 30 days ago)
 */
export async function getMetrics(req, res) {
  try {
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const { UserModel, MessageModel, LikeModel } = await models();

    const [usersTotal, usersNew, premiumUsers, messagesCount, likesCount] = await Promise.all([
      UserModel?.countDocuments?.({}) ?? 0,
      UserModel?.countDocuments?.({ createdAt: { $gte: sinceDate } }) ?? 0,
      UserModel?.countDocuments?.({ $or: [{ isPremium: true }, { premium: true }] }) ?? 0,
      MessageModel?.countDocuments?.({ createdAt: { $gte: sinceDate } }) ?? 0,
      LikeModel?.countDocuments?.({ createdAt: { $gte: sinceDate } }) ?? 0,
    ]);

    return res.json({
      since: sinceDate.toISOString(),
      users: {
        total: usersTotal,
        new: usersNew,
        premium: premiumUsers,
      },
      engagement: {
        messages: messagesCount,
        likes: likesCount,
      },
    });
  } catch (e) {
    // Avoid leaking internals
    return res.status(500).json({ error: 'Failed to load metrics' });
  }
}

/**
 * GET /api/admin/stripe/revenue
 * Query:
 *  - start=<ISO> (required)
 *  - end=<ISO>   (required)
 *  - mode=test|live (optional; default inferred from key)
 *
 * Sums successful payment intents (or paid invoices) within the window.
 * Falls back nicely if Stripe key not configured.
 */
export async function getStripeRevenue(req, res) {
  try {
    const { start, end, mode } = req.query;
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({ enabled: false, total: 0, currency: 'usd', items: [] });
    }

    const startTs = start ? Math.floor(new Date(start).getTime() / 1000) : null;
    const endTs = end ? Math.floor(new Date(end).getTime() / 1000) : null;
    if (!startTs || !endTs || Number.isNaN(startTs) || Number.isNaN(endTs)) {
      return res.status(400).json({ error: 'start and end query params (ISO) are required' });
    }

    // Lazy import Stripe client (ESM safe)
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

    // First try Payment Intents (status: succeeded)
    const intents = await stripe.paymentIntents.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
    });

    let total = 0;
    const items = [];
    for (const pi of intents.data || []) {
      if (pi.status === 'succeeded') {
        const amount = pi.amount_received ?? pi.amount ?? 0;
        total += amount;
        items.push({
          id: pi.id,
          amount,
          currency: pi.currency || 'usd',
          created: pi.created,
          customer: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id,
        });
      }
    }

    // Normalize to main currency from first item (or usd)
    const currency = (items[0]?.currency || 'usd').toLowerCase();

    return res.json({
      enabled: true,
      mode: mode || (process.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live' : 'test'),
      start,
      end,
      total,
      currency,
      count: items.length,
      items,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load Stripe revenue' });
  }
}
// --- REPLACE END ---
,