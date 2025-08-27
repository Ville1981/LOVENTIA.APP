// --- REPLACE START: convert Message model to CommonJS require ---
'use strict';

const mongoose = require('mongoose');

// Define Message schema
const messageSchema = new mongoose.Schema(
  {
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content:   { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    // add other fields here as needed
  },
  { timestamps: true }
);

// Avoid OverwriteModelError in watch mode/tests
let MessageModel;
try {
  MessageModel = mongoose.model('Message');
} catch (_) {
  MessageModel = mongoose.model('Message', messageSchema);
}

module.exports = MessageModel;
// --- REPLACE END ---
