// server/models/Image.js
const mongoose = require('mongoose');

/**
 * Image schema stores both avatar and extra user-uploaded photos.
 * Fields:
 * - url: Relative path to the uploaded file (required)
 * - owner: Reference to the User who owns this image (required)
 * - isAvatar: Flag to mark if this image is the user's profile avatar
 * - uploaded: Timestamp when the image was uploaded
 * - caption: Optional caption or description for extra images
 */
const ImageSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isAvatar: { type: Boolean, default: false },
  uploaded: { type: Date, default: Date.now },
  caption:  { type: String, default: '' },
});

module.exports = mongoose.model('Image', ImageSchema);
