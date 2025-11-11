// File: server/controllers/likesController.js

// --- REPLACE START: Likes controller (ESM) ---
'use strict';

/**
 * Controller for like/unlike and listing likes & matches.
 * Keeps payloads minimal and responses consistent with existing API style.
 */

import User from '../models/User.js';

/**
 * POST /api/likes/:targetId
 * Add a like from the authenticated user to target user.
 */
export async function likeUser(req, res) {
  try {
    const actorId = req.userId || req.user?.id;
    const targetId = req.params.targetId;

    if (!actorId || !targetId) {
      return res.status(400).json({ error: 'Missing user id(s)' });
    }
    if (String(actorId) === String(targetId)) {
      return res.status(400).json({ error: 'You cannot like yourself' });
    }

    const [actor, target] = await Promise.all([
      User.findById(actorId),
      User.findById(targetId),
    ]);

    if (!actor || !target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add to actor.likes; ensure array exists
    if (!Array.isArray(actor.likes)) actor.likes = [];
    // Mongoose: $addToSet avoids duplicates
    await User.updateOne({ _id: actor._id }, { $addToSet: { likes: target._id } });

    // Check if it's now a match (both ways)
    const isMatch = Array.isArray(target.likes) && target.likes.some((id) => String(id) === String(actor._id));

    return res.json({ ok: true, likedUserId: String(target._id), match: !!isMatch });
  } catch (err) {
    console.error('[likesController.likeUser] error:', err);
    return res.status(500).json({ error: 'Unable to like user' });
  }
}

/**
 * DELETE /api/likes/:targetId
 * Remove a like.
 */
export async function unlikeUser(req, res) {
  try {
    const actorId = req.userId || req.user?.id;
    const targetId = req.params.targetId;

    if (!actorId || !targetId) {
      return res.status(400).json({ error: 'Missing user id(s)' });
    }

    await User.updateOne({ _id: actorId }, { $pull: { likes: targetId } });
    return res.json({ ok: true, unlikedUserId: String(targetId) });
  } catch (err) {
    console.error('[likesController.unlikeUser] error:', err);
    return res.status(500).json({ error: 'Unable to unlike user' });
  }
}

/**
 * GET /api/likes/outgoing
 * List users that the actor has liked.
 */
export async function listOutgoingLikes(req, res) {
  try {
    const actorId = req.userId || req.user?.id;
    if (!actorId) return res.status(401).json({ error: 'Unauthorized' });

    const actor = await User.findById(actorId).select('likes').lean();
    if (!actor) return res.status(404).json({ error: 'User not found' });

    const ids = Array.isArray(actor.likes) ? actor.likes : [];
    const users = ids.length
      ? await User.find({ _id: { $in: ids } })
          .select('username profilePicture location.city location.region location.country isPremium entitlements.tier')
          .lean()
      : [];

    return res.json({ ok: true, count: users.length, users });
  } catch (err) {
    console.error('[likesController.listOutgoingLikes] error:', err);
    return res.status(500).json({ error: 'Unable to fetch outgoing likes' });
  }
}

/**
 * GET /api/likes/incoming
 * List users who have liked the actor (reverse lookup).
 */
export async function listIncomingLikes(req, res) {
  try {
    const actorId = req.userId || req.user?.id;
    if (!actorId) return res.status(401).json({ error: 'Unauthorized' });

    const users = await User.find({ likes: actorId })
      .select('username profilePicture location.city location.region location.country isPremium entitlements.tier')
      .lean();

    return res.json({ ok: true, count: users.length, users });
  } catch (err) {
    console.error('[likesController.listIncomingLikes] error:', err);
    return res.status(500).json({ error: 'Unable to fetch incoming likes' });
  }
}

/**
 * GET /api/likes/matches
 * Mutual likes between actor and others.
 */
export async function listMatches(req, res) {
  try {
    const actorId = req.userId || req.user?.id;
    if (!actorId) return res.status(401).json({ error: 'Unauthorized' });

    const actor = await User.findById(actorId).select('likes').lean();
    if (!actor) return res.status(404).json({ error: 'User not found' });

    const outgoing = new Set((actor.likes || []).map((id) => String(id)));

    // Users who liked actor
    const incomingUsers = await User.find({ likes: actorId })
      .select('username profilePicture likes isPremium entitlements.tier')
      .lean();

    const matches = incomingUsers.filter((u) => outgoing.has(String(u._id)));

    // Return slimmed fields
    const users = matches.map((u) => ({
      _id: String(u._id),
      username: u.username,
      profilePicture: u.profilePicture || null,
      premium: !!(u.isPremium || u?.entitlements?.tier === 'premium'),
    }));

    return res.json({ ok: true, count: users.length, users });
  } catch (err) {
    console.error('[likesController.listMatches] error:', err);
    return res.status(500).json({ error: 'Unable to fetch matches' });
  }
}
// --- REPLACE END ---
