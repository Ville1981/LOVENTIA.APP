// server/models/Image.js

const mongoose = require('mongoose');

/**
 * Image schema stores both avatar and extra user-uploaded photos.
 * Fields:
 * - url: Relative path or URL to the uploaded file (required)
 * - owner: Reference to the User who owns this image (required)
 * - isAvatar: Boolean flag indicating if this is the user's profile avatar
 * - uploaded: Timestamp when the image was uploaded
 * - caption: Optional caption for extra images
 */
const ImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'Image URL is required'],
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Image owner is required'],
  },
  isAvatar: {
    type: Boolean,
    default: false,
  },
  uploaded: {
    type: Date,
    default: Date.now,
  },
  caption: {
    type: String,
    default: '',
    maxlength: [200, 'Caption cannot exceed 200 characters'],
  },
});

// Index owner + isAvatar for fast lookups
ImageSchema.index({ owner: 1, isAvatar: 1 });

module.exports = mongoose.model('Image', ImageSchema);
