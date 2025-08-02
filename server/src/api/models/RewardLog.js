// src/api/models/RewardLog.js

import mongoose from 'mongoose';
const { Schema } = mongoose;

const rewardLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  referralCode: { type: String, required: true },
  type: { type: String, enum: ['click', 'signup'], required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('RewardLog', rewardLogSchema);
