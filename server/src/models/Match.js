// --- REPLACE START: minimal, production-safe Match model (ESM + Mongoose) ---
/**
 * Match model
 * - Stores a conversation/match between exactly two users.
 * - ESM-compatible export (project uses "type":"module").
 * - Avoids OverwriteModelError by reusing existing compiled model.
 *
 * Fields
 *  - users: [ObjectId, ObjectId] — required; always stored in sorted order
 *  - status: "active" | "blocked" | "ended" (default: "active")
 *  - lastMessageAt: Date — updated by messaging layer if available
 *  - meta: free-form object for future safe extensions
 *
 * Indexes
 *  - Compound unique index on { users[0], users[1] } to ensure one match per pair
 *    (order-independent thanks to sorting in pre-validate hook)
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

const MatchSchema = new Schema(
  {
    users: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      validate: {
        validator(arr) {
          // exactly two distinct users
          return Array.isArray(arr) && arr.length === 2 && String(arr[0]) !== String(arr[1]);
        },
        message: "A match must reference exactly two distinct users.",
      },
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "blocked", "ended"],
      default: "active",
      index: true,
    },

    lastMessageAt: { type: Date, default: null, index: true },

    // Room for optional, non-breaking additions (kept flexible)
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true, // createdAt, updatedAt
    minimize: true,
    versionKey: false,
  }
);

/**
 * Ensure the user pair is stored in deterministic order [a,b] where a<b as strings.
 * This makes the unique pair index (users_0, users_1) effectively order-independent.
 */
MatchSchema.pre("validate", function normalizeUsers(next) {
  try {
    if (Array.isArray(this.users) && this.users.length === 2) {
      const [a, b] = this.users.map((u) => (u ? String(u) : ""));
      if (a && b) {
        const sorted = [a, b].sort();
        // Reassign as ObjectIds in sorted order
        this.users = sorted.map((s) => new mongoose.Types.ObjectId(s));
      }
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Unique pair index (order-independent thanks to pre-validate sorting)
MatchSchema.index({ "users.0": 1, "users.1": 1 }, { unique: true, name: "uniq_match_pair" });

// Helpful virtual to expose a stable thread key "userIdA__userIdB"
MatchSchema.virtual("threadKey").get(function threadKey() {
  if (Array.isArray(this.users) && this.users.length === 2) {
    return `${String(this.users[0])}__${String(this.users[1])}`;
  }
  return "";
});

// Export safely (reuse if already compiled)
const Match =
  mongoose.models.Match || mongoose.model("Match", MatchSchema, "matches");

export default Match;
// --- REPLACE END ---
