// models/RefreshToken.js

import mongoose from 'mongoose';

/**
 * Schema for storing user refresh tokens
 */
const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * RefreshToken model
 */
const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
