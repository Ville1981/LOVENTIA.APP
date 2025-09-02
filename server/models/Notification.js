// File: server/models/Notification.js

// --- REPLACE START: Notification model (ESM with CJS fallback) ---
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Notification Schema
 * Fields:
 * - toUser: recipient user (ObjectId, required)
 * - fromUser: sender/actor user (ObjectId, optional)
 * - type: string type ("superlike", "like", etc.)
 * - message: optional message text
 * - read: boolean, default false
 * - createdAt: Date, default now
 */
const notificationSchema = new Schema(
  {
    toUser: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fromUser: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true, trim: true, index: true },
    message: { type: String, trim: true },
    read: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index: newest unread for a given user
notificationSchema.index({ toUser: 1, read: 1, createdAt: -1 });

// Reuse model if already compiled (hot-reload/dev)
const Notification = models?.Notification || model("Notification", notificationSchema);

export default Notification;
// --- REPLACE END ---
