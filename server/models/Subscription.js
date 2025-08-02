const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  plan: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free',
  },
  status: {
    type: String,
    enum: ['active', 'canceled'],
    default: 'active',
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endsAt: {
    type: Date,
  },
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
