// File: server/src/controllers/adminMetricsController.js

// --- REPLACE START: minimal metrics aggregation with safe fallbacks (de-duplicated single declarations) ---
/**
 * Admin Metrics Controller
 * - Aggregates lightweight KPIs for dashboard widgets.
 * - Uses lazy ESM imports to avoid startup crashes if files move.
 * - IMPORTANT: Model variables are declared ONCE at module scope to prevent
 *   "Identifier 'X' has already been declared" errors.
 */

import dayjs from "dayjs";

// Declare ONCE (do not redeclare these anywhere in this file)
let UserModel = null;
let MessageModel = null;
let PaymentModel = null;

/**
 * Lazily resolve models. Safe to call multiple times.
 * Each model is imported only if not already cached.
 */
async function getModels() {
  if (!UserModel) {
    try {
      const m = await import("../models/User.js");
      UserModel = m?.default || m?.User || m || null;
    } catch {
      UserModel = null;
    }
  }
  if (!MessageModel) {
    try {
      const m = await import("../models/Message.js");
      MessageModel = m?.default || m?.Message || m || null;
    } catch {
      MessageModel = null;
    }
  }
  if (!PaymentModel) {
    try {
      const m = await import("../models/Payment.js");
      PaymentModel = m?.default || m?.Payment || m || null;
    } catch {
      PaymentModel = null;
    }
  }
}

/**
 * Small helper to guard countDocuments when model may be missing.
 */
async function safeCount(model, query) {
  try {
    if (!model?.countDocuments) return 0;
    return await model.countDocuments(query || {});
  } catch {
    return 0;
  }
}

/**
 * GET /api/admin/summary (or wherever this is mounted)
 * Returns:
 *   - totals: users, premium, revenueMtd
 *   - activity: dau, wau, mau
 *   - series: 7-day signups and messages (label/value pairs)
 */
export async function getSummary(req, res) {
  try {
    await getModels();

    // Totals
    const usersTotal = await safeCount(UserModel, {});
    const premiumTotal = await safeCount(UserModel, {
      $or: [{ isPremium: true }, { premium: true }, { "premium.active": true }],
    });

    // Revenue Month-To-Date (assumes mirrored/recorded payments in your DB)
    let revenueMtd = 0;
    if (PaymentModel?.aggregate) {
      const monthStart = dayjs().startOf("month").toDate();
      const paid = await PaymentModel.aggregate([
        { $match: { status: "succeeded", createdAt: { $gte: monthStart } } },
        { $group: { _id: null, sum: { $sum: "$amount" } } }, // amount unit depends on your schema (e.g., cents)
      ]);
      revenueMtd = paid?.[0]?.sum || 0;
    }

    // Activity windows
    const now = dayjs();
    const dau = await safeCount(UserModel, { lastActiveAt: { $gte: now.subtract(1, "day").toDate() } });
    const wau = await safeCount(UserModel, { lastActiveAt: { $gte: now.subtract(7, "day").toDate() } });
    const mau = await safeCount(UserModel, { lastActiveAt: { $gte: now.subtract(30, "day").toDate() } });

    // 7-day labels (today-6d → today)
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      labels.push(dayjs().subtract(i, "day").format("MMM D"));
    }

    // Signups by day (7d)
    const signupsMap = new Map(labels.map((l) => [l, 0]));
    if (UserModel?.aggregate) {
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
      for (const g of agg) {
        const dt = dayjs(`${g._id.y}-${g._id.m}-${g._id.d}`).format("MMM D");
        signupsMap.set(dt, g.count);
      }
    }

    // Messages by day (7d)
    const msgsMap = new Map(labels.map((l) => [l, 0]));
    if (MessageModel?.aggregate) {
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
      for (const g of agg) {
        const dt = dayjs(`${g._id.y}-${g._id.m}-${g._id.d}`).format("MMM D");
        msgsMap.set(dt, g.count);
      }
    }

    const series = {
      signups7d: labels.map((l) => ({ label: l, value: signupsMap.get(l) || 0 })),
      messages7d: labels.map((l) => ({ label: l, value: msgsMap.get(l) || 0 })),
    };

    return res.json({
      totals: { users: usersTotal, premium: premiumTotal, revenueMtd },
      activity: { dau, wau, mau },
      series,
    });
  } catch (err) {
    console.error("[adminMetrics] summary failed:", err);
    return res.status(500).json({ error: "Failed to aggregate KPIs." });
  }
}

export default { getSummary };
// --- REPLACE END ---
