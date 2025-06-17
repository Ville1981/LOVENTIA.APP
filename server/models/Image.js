// server/models/Image.js
const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isAvatar: { type: Boolean, default: false },
  uploaded: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Image', ImageSchema);
