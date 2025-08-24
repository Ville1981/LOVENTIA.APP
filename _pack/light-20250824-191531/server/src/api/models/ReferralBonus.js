// --- REPLACE START: convert ESM import/export to CommonJS; keep logic intact ---
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const referralBonusSchema = new Schema({
  referral:  { type: Schema.Types.ObjectId, ref: 'Referral', required: true },
  user:      { type: Schema.Types.ObjectId, ref: 'User',     required: true },
  amount:    { type: Number,                                   required: true },
  type:      { type: String, enum: ['referral', 'signup', 'purchase'], default: 'referral' },
  status:    { type: String, enum: ['pending', 'granted', 'redeemed'],  default: 'pending' },
  createdAt: { type: Date,                                     default: Date.now },
  grantedAt: { type: Date },
  redeemedAt:{ type: Date }
});

module.exports = mongoose.model('ReferralBonus', referralBonusSchema);
// --- REPLACE END ---
