// File: server/models/Message.cjs

// --- REPLACE START: robust CommonJS Message model with dual-field compatibility + overview ---
'use strict';

const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Message schema that supports BOTH legacy and new field names:
 *   - receiver  | recipient  (peer user id)
 *   - text      | content    (message body)
 *   - createdAt | timestamp  (time fields)
 *
 * We mirror the pairs in a pre('validate') hook so whichever side is provided,
 * both sides will be set. This keeps routes/aggregations stable across versions.
 */

const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Newer name (some code paths use this)
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },

    // Legacy name (your current DB writes use this)
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },

    // Newer name
    text: {
      type: String,
      required: false,
      trim: true,
    },

    // Legacy name (your current DB writes use this)
    content: {
      type: String,
      required: false,
      trim: true,
    },

    // Prefer createdAt from timestamps, but keep explicit timestamp for legacy writes
    timestamp: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
  }
);

/**
 * Ensure dual-field mirroring before validation:
 * - receiver <-> recipient
 * - text <-> content
 * - createdAt <-> timestamp
 * Also enforce that we have a peer id and a body after mirroring.
 */
messageSchema.pre('validate', function preValidate(next) {
  // Mirror receiver/recipient
  if (!this.receiver && this.recipient) this.receiver = this.recipient;
  if (!this.recipient && this.receiver) this.recipient = this.receiver;

  // Mirror text/content
  if (!this.text && this.content) this.text = this.content;
  if (!this.content && this.text) this.content = this.text;

  // Mirror createdAt/timestamp (prefer createdAt from timestamps)
  if (!this.createdAt && this.timestamp) this.createdAt = this.timestamp;
  if (!this.timestamp && this.createdAt) this.timestamp = this.createdAt;
  if (!this.createdAt && !this.timestamp) {
    const now = new Date();
    this.createdAt = now;
    this.timestamp = now;
  }

  // Basic validations after mirroring (keep error messages explicit)
  if (!this.sender) {
    return next(
      new mongoose.Error.ValidationError(
        Object.assign(new Error('Sender is required'), { path: 'sender' })
      )
    );
  }
  if (!this.receiver && !this.recipient) {
    return next(
      new mongoose.Error.ValidationError(
        Object.assign(new Error('Receiver/recipient is required'), {
          path: 'receiver',
        })
      )
    );
  }
  if (
    !(this.text && String(this.text).trim()) &&
    !(this.content && String(this.content).trim())
  ) {
    return next(
      new mongoose.Error.ValidationError(
        Object.assign(new Error('Message text/content is required'), {
          path: 'text',
        })
      )
    );
  }

  next();
});

/**
 * Static: getOverviewForUser(userId)
 * Returns lightweight conversation rows:
 *   [{
 *      userId,
 *      lastMessageTime,
 *      snippet,
 *      unreadCount,
 *      displayName,
 *      avatarUrl,
 *      isPremium,
 *      premiumTier
 *   }]
 *
 * - Matches messages where (sender==user) OR (receiver==user) OR (recipient==user)
 * - Normalizes peer id: other = (sender==user) ? (receiver||recipient) : sender
 * - Uses max of createdAt|timestamp as time
 * - Uses text||content as snippet
 * - Enriches with partner user data from `users` collection
 * - Sorted by lastMessageTime DESC
 */
// --- REPLACE START: overview pipeline with user enrichment ---
messageSchema.statics.getOverviewForUser = async function getOverviewForUser(userId) {
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const pipeline = [
    {
      $match: {
        $or: [{ sender: uid }, { receiver: uid }, { recipient: uid }],
      },
    },
    {
      // Normalize fields to unified aliases for aggregation
      $addFields: {
        _peer: { $ifNull: ['$receiver', '$recipient'] },
        _text: { $ifNull: ['$text', '$content'] },
        _time: { $ifNull: ['$createdAt', '$timestamp'] },
      },
    },
    {
      // Compute the "other/peer" id for this row
      $addFields: {
        peerId: {
          $cond: [{ $eq: ['$sender', uid] }, '$_peer', '$sender'],
        },
      },
    },
    // Sort ascending by time so $last in the group will be the latest
    { $sort: { _time: 1, _id: 1 } },
    {
      $group: {
        _id: '$peerId',
        lastMessageTime: { $last: '$_time' },
        snippet: { $last: '$_text' },
      },
    },
    // Sort final rows by recency
    { $sort: { lastMessageTime: -1 } },
    // Enrich with partner User document (collection name is "users" by default in Mongoose)
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'partner',
      },
    },
    {
      $unwind: {
        path: '$partner',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        lastMessageTime: 1,
        snippet: 1,
        // Placeholder for unreadCount; accurate unread requires read receipts
        unreadCount: { $literal: 0 },

        // Best effort display name:
        // displayName > name > firstName > email > "Unknown user"
        displayName: {
          $ifNull: [
            '$partner.displayName',
            {
              $ifNull: [
                '$partner.name',
                {
                  $ifNull: [
                    '$partner.firstName',
                    {
                      $ifNull: ['$partner.email', 'Unknown user'],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Best effort avatar URL:
        // profilePicture > avatar > profilePhoto > photos[0] > null
        avatarUrl: {
          $ifNull: [
            '$partner.profilePicture',
            {
              $ifNull: [
                '$partner.avatar',
                {
                  $ifNull: [
                    '$partner.profilePhoto',
                    { $arrayElemAt: ['$partner.photos', 0] },
                  ],
                },
              ],
            },
          ],
        },

        // Premium flags for UI badges (conversation list)
        isPremium: {
          $cond: [
            {
              $or: [
                { $eq: ['$partner.isPremium', true] },
                { $eq: ['$partner.premium', true] },
                { $eq: ['$partner.entitlements.tier', 'premium'] },
              ],
            },
            true,
            false,
          ],
        },
        premiumTier: '$partner.entitlements.tier',
      },
    },
  ];

  return this.aggregate(pipeline).exec();
};
// --- REPLACE END ---

/**
 * Helpful indexes for common queries and aggregation performance.
 * We keep both receiver and recipient variants indexed.
 */
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });

// Avoid OverwriteModelError in watch mode/tests
let MessageModel;
try {
  MessageModel = mongoose.model('Message');
} catch (_) {
  MessageModel = mongoose.model('Message', messageSchema);
}

module.exports = MessageModel;
// --- REPLACE END ---


