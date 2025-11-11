// File: server/src/controllers/superlikeController.js

// --- REPLACE START: superlike controller reading quota from entitlements (numeric, weekly) ---
'use strict';

import mongoose from 'mongoose';

const PREMIUM_FALLBACK = Number(process.env.SUPERLIKES_PER_WEEK || 3);

/**
 * This controller:
 *  - Validates the target id.
 *  - Reads the numeric weekly quota from user.entitlements.features.superLikesPerWeek.
 *  - Tracks usage in user.entitlements.quotas.superLikes.{used, weekKey}.
 *  - Resets usage when ISO week changes.
 *  - Enforces limit (403 + code='LIMIT_REACHED' when exceeded).
 *  - Optionally delegates to a root controller if present (after quota accounting).
 *
 * Success payload shape (if we respond):
 *   { ok: true, superliked: "<targetId>", remaining, limit, resetAt }
 */

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
  if (mongoose?.Types?.ObjectId?.isValid) return mongoose.Types.ObjectId.isValid(id);
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

/** YYYY-Www (ISO week), e.g. "2025-W45" */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // 0..6, Mon..Sun
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  const wk = String(week).padStart(2, '0');
  return `${date.getUTCFullYear()}-W${wk}`;
}

/** Start-of-next ISO week as a Date */
function nextIsoWeekStart(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  const daysToNextMon = (7 - dayNum) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysToNextMon);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Read weekly limit from entitlements (numeric).
 * - If boolean `true` (legacy), treat as PREMIUM_FALLBACK (default 3).
 * - If number, clamp to >= 0 integer.
 * - If user is premium but field is missing, use PREMIUM_FALLBACK.
 * - Otherwise 0 (no entitlement).
 */
function resolveQuotaLimitFromEntitlements(user, dbEntitlements) {
  const rawFromUser = user?.entitlements?.features?.superLikesPerWeek;
  const rawFromDb = dbEntitlements?.features?.superLikesPerWeek;
  const raw = (typeof rawFromDb !== 'undefined') ? rawFromDb : rawFromUser;

  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (raw === true) return PREMIUM_FALLBACK;
  const premiumFlag =
    user?.isPremium === true ||
    user?.premium === true ||
    dbEntitlements?.isPremium === true ||
    dbEntitlements?.premium === true;
  if (premiumFlag) return PREMIUM_FALLBACK;
  return 0;
}

/**
 * Ensure/refresh the weekly bucket on the *in-memory* user snapshot.
 * (We still enforce using DB values; this only keeps req.user coherent.)
 */
function ensureQuotaBucket(user) {
  if (!user.entitlements) user.entitlements = {};
  if (!user.entitlements.quotas) user.entitlements.quotas = {};
  if (!user.entitlements.quotas.superLikes) user.entitlements.quotas.superLikes = {};
  const bucket = user.entitlements.quotas.superLikes;

  const nowKey = isoWeekKey();
  if (bucket.weekKey !== nowKey) {
    bucket.weekKey = nowKey;
    bucket.used = 0;
  }
  if (typeof bucket.used !== 'number' || !Number.isFinite(bucket.used)) {
    bucket.used = 0;
  }
  return bucket;
}

// Best-effort dynamic delegation to an existing root controller (if your project has one)
let _rootCtrl = null;
async function getRootCtrl() {
  if (_rootCtrl) return _rootCtrl;
  const candidates = [
    '../../controllers/superlikeController.js',
    '../../controllers/superlikesController.js',
    '../../controllers/superLikeController.js',
    '../../controllers/superLikesController.js',
  ];
  for (const rel of candidates) {
    try {
      const mod = await import(rel);
      _rootCtrl = mod?.default || mod || null;
      if (_rootCtrl) return _rootCtrl;
    } catch { /* continue */ }
    try {
      // eslint-disable-next-line no-undef
      const cjs = typeof require !== 'undefined' ? require(rel) : null;
      if (cjs) {
        _rootCtrl = cjs?.default || cjs || null;
        if (_rootCtrl) return _rootCtrl;
      }
    } catch { /* continue */ }
  }
  return null;
}

/** Compose response payload consistently */
function makeOkPayload(targetId, limit, used) {
  return {
    ok: true,
    superliked: String(targetId),
    remaining: Math.max(0, limit - used),
    limit,
    resetAt: nextIsoWeekStart().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Model loader (no hard import at top-level)
// ──────────────────────────────────────────────────────────────────────────────
async function loadUserModel() {
  try {
    const m = await import('../models/User.js'); // server/src/models/User.js
    return m?.default || m?.User || m || null;
  } catch {
    try {
      const m = await import('../../models/User.js'); // server/models/User.js
      return m?.default || m?.User || m || null;
    } catch {
      return null;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Controller
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/superlike/:id
 * Reads limit from entitlements, updates quota usage, and (optionally) delegates to root.
 */
export async function superlikeUser(req, res) {
  try {
    const user = req?.user || {};
    const subjectId = req?.userId || user?._id || user?.id || null; // prefer req.userId
    if (!subjectId) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const targetId =
      req?.params?.id ||
      req?.params?.targetId ||
      req?.body?.targetUserId ||
      req?.body?.targetId ||
      req?.body?.id;

    if (!targetId) {
      return res.status(400).json({ ok: false, error: 'Target id is required' });
    }
    if (!isValidObjectId(targetId)) {
      return res
        .status(400)
        .json({ ok: false, error: 'Invalid id format (expected 24-hex ObjectId)' });
    }

    // Prepare in-memory bucket (keeps req.user coherent)
    const bucket = ensureQuotaBucket(user);
    const nowKey = bucket.weekKey || isoWeekKey();

    // 🔎 DB snapshot (enforce against DB, not token snapshot)
    let dbEntitlements = null;
    let dbUsed = 0;
    let dbWeekKey = nowKey;

    const UserModel = await loadUserModel();
    if (subjectId && UserModel) {
      const doc = await UserModel.findById(subjectId, {
        _id: 1,
        premium: 1,
        isPremium: 1,
        'entitlements.features.superLikesPerWeek': 1,
        'entitlements.premium': 1,
        'entitlements.isPremium': 1,
        'entitlements.quotas.superLikes.weekKey': 1,
        'entitlements.quotas.superLikes.used': 1,
      }).lean();

      if (doc?.entitlements) {
        dbEntitlements = {
          ...doc.entitlements,
          premium: doc?.premium ?? doc?.entitlements?.premium,
          isPremium: doc?.isPremium ?? doc?.entitlements?.isPremium,
        };
        dbWeekKey = doc?.entitlements?.quotas?.superLikes?.weekKey || nowKey;
        dbUsed = doc?.entitlements?.quotas?.superLikes?.used ?? 0;
      } else {
        dbEntitlements = { premium: doc?.premium, isPremium: doc?.isPremium };
      }

      if (dbWeekKey !== nowKey) dbUsed = 0;
    }

    // 1) Determine limit (prefer DB entitlements when present)
    const limit = resolveQuotaLimitFromEntitlements(user, dbEntitlements);

    // 2) Enforce against DB-used
    if (!limit || dbUsed >= limit) {
      return res.status(403).json({
        ok: false,
        code: 'LIMIT_REACHED',
        error: 'Weekly Super Like limit reached.',
        remaining: 0,
        limit,
        resetAt: nextIsoWeekStart().toISOString(),
      });
    }

    // 3) Atomically persist consumption and read the updated value
    let updatedUsed = dbUsed + 1;

    if (subjectId && UserModel) {
      try {
        // IMPORTANT: allow dotted paths even if schema lacks them
        const updateStrictOpts = { strict: false };

        if (dbWeekKey !== nowKey) {
          await UserModel.updateOne(
            { _id: subjectId },
            {
              $set: {
                'entitlements.quotas.superLikes.weekKey': nowKey,
                'entitlements.quotas.superLikes.used': 0,
              },
            },
            updateStrictOpts
          );
        }

        const after = await UserModel.findByIdAndUpdate(
          subjectId,
          {
            $set: { 'entitlements.quotas.superLikes.weekKey': nowKey },
            $inc: { 'entitlements.quotas.superLikes.used': 1 },
          },
          {
            new: true,
            projection: { 'entitlements.quotas.superLikes.used': 1, _id: 0 },
            ...updateStrictOpts, // ensure Mongoose does not strip unknown dotted paths
          }
        ).lean();

        const usedFromDoc = after?.entitlements?.quotas?.superLikes?.used;
        if (typeof usedFromDoc === 'number' && Number.isFinite(usedFromDoc)) {
          updatedUsed = usedFromDoc;
        }

        // Mirror to in-memory view (optional)
        bucket.weekKey = nowKey;
        bucket.used = updatedUsed;
      } catch (e) {
        // Log once in server logs without leaking details to clients
        // eslint-disable-next-line no-console
        console.warn('[superlike] DB persist failed, continuing with in-memory bucket:', e?.message || e);
        bucket.used = (typeof bucket.used === 'number' ? bucket.used : 0) + 1;
        updatedUsed = bucket.used;
      }
    } else {
      bucket.used = (typeof bucket.used === 'number' ? bucket.used : 0) + 1;
      updatedUsed = bucket.used;
    }

    // 4) Optional delegation to domain/root controller AFTER accounting
    try {
      const root = await getRootCtrl();
      const impl =
        root?.superlikeUser ||
        root?.superLikeUser ||
        root?.superlike ||
        root?.createSuperlike ||
        root?.create;

      if (typeof impl === 'function') {
        req.params = req.params || {};
        req.params.id = targetId;

        await impl(req, res);

        if (res.headersSent) return;
        return res.json(makeOkPayload(targetId, limit, updatedUsed));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[superlike] delegation skipped:', e?.message || e);
    }

    // 5) Respond with our standard payload
    return res.json(makeOkPayload(targetId, limit, updatedUsed));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[superlike] error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
  }
}

/** Alias used by some routers/services */
export const create = superlikeUser;

/** Body-based variant for /api/superlikes route (if present) */
export async function superlikeByBody(req, res) {
  req.params = req.params || {};
  req.params.id =
    req?.body?.id || req?.body?.userId || req?.body?.targetId || req?.body?.targetUserId;
  return superlikeUser(req, res);
}

/** Default export as callable middleware */
export default async function superlikeControllerMiddleware(req, res) {
  return superlikeUser(req, res);
}
// --- REPLACE END ---


