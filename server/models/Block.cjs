// PATH: server/models/Block.cjs
// --- REPLACE START: Block model (CJS) ---

const mongoose = require("mongoose");

const { Schema } = mongoose;

const BlockSchema = new Schema(
  {
    blocker: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blocked: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// A user can block another user only once
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

module.exports =
  mongoose.models.Block || mongoose.model("Block", BlockSchema);

// --- REPLACE END ---
