// --- REPLACE START: convert ESM import/export to CommonJS; keep logic intact ---
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const rewardLogSchema = new Schema({
  user:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  referralCode: { type: String,                               required: true },
  type:         { type: String, enum: ['click', 'signup'],    required: true },
  amount:       { type: Number,                               required: true },
  createdAt:    { type: Date,                                 default: Date.now }
});

module.exports = mongoose.model('RewardLog', rewardLogSchema);
// --- REPLACE END ---
