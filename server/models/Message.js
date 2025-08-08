// File: server/models/Message.js

// --- REPLACE START: convert Message model to CommonJS require ---
'use strict';

const mongoose = require('mongoose');
// --- REPLACE END ---

// Define Message schema
const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    // add other fields here as needed
  },
  { timestamps: true }
);

// --- REPLACE START: export Message model as CommonJS ---
let MessageModel;
try {
  MessageModel = mongoose.model('Message');
} catch (_) {
  MessageModel = mongoose.model('Message', messageSchema);
}

module.exports = MessageModel;
// --- REPLACE END ---
