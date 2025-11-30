// File: server/models/Report.cjs
// Passive abuse/safety report model (CJS, bridged to ESM via server/src/models/Report.js)

const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReportSchema = new Schema(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    message: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "spam",
        "scam",
        "abuse",
        "fake_profile",
        "underage",
        "other",
      ],
    },
    details: {
      type: String,
      trim: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: ["open", "reviewed"],
      default: "open",
    },
    metadata: {
      userAgent: { type: String },
      ip: { type: String },
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: true,
    },
  }
);

// Useful indexes for later admin tools (passive v1 already benefits)
ReportSchema.index({ reporter: 1, createdAt: -1 });
ReportSchema.index({ targetUser: 1, createdAt: -1 });
ReportSchema.index({ message: 1, createdAt: -1 });

module.exports =
  mongoose.models.Report || mongoose.model("Report", ReportSchema);
