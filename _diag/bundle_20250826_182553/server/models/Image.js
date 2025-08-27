import mongoose from 'mongoose';

// --- REPLACE START: convert to ES module and export default model (with hot-reload safety) ---
/**
 * Image model
 * - Keeps fields identical to your previous schema
 * - Uses mongoose.models.Image if already compiled to avoid OverwriteModelError
 */
const imageSchema = new mongoose.Schema({
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url:      { type: String, required: true },
  uploaded: { type: Date, default: Date.now },
  isAvatar: { type: Boolean, default: false },
  caption:  { type: String },
});

// Reuse existing compiled model when present (watch mode / tests)
const Image = mongoose.models.Image || mongoose.model('Image', imageSchema);

export default Image;
// --- REPLACE END ---
