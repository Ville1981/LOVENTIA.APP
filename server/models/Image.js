// server/models/Image.js

import mongoose from 'mongoose';

// --- REPLACE START: convert to ES module and export default model ---
const imageSchema = new mongoose.Schema({
  owner:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url:          { type: String, required: true },
  uploaded:     { type: Date, default: Date.now },
  isAvatar:     { type: Boolean, default: false },
  caption:      { type: String },
});

const Image = mongoose.model('Image', imageSchema);

export default Image;
// --- REPLACE END ---
