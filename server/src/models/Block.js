// PATH: server/src/models/Block.js

// --- REPLACE START: ESM wrapper for Block model ---

import mongoose from "mongoose";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let Block;

try {
  // Primary path: server/models/Block.cjs
  // (from server/src/models/Block.js → ../../models/Block.cjs)
  // eslint-disable-next-line global-require, import/no-dynamic-require
  Block = require("../../models/Block.cjs");
} catch (err) {
  // Fallback: define the schema here if CJS model is not found
  // This should almost never happen in normal use.
  // eslint-disable-next-line no-console
  console.error("Failed to load CJS Block model, using fallback:", err);

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

  Block = mongoose.models.Block || mongoose.model("Block", BlockSchema);
}

export default Block;
export { Block };

// --- REPLACE END ---
