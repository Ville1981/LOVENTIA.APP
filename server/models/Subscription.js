// server/models/Subscription.js

import mongoose from 'mongoose';

// --- REPLACE START: define Subscription schema and export default model ---
const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['premium', 'basic'],
    required: true
  },
  provider: {
    type: String,
    enum: ['stripe', 'paypal'],
    required: true
  },
  subscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
// --- REPLACE END ---
