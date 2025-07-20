// server/config/multer.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Multer configuration for handling user profile and extra photo uploads.
 * Ensures separate directories for profiles and extra images,
 * filters to only allow images, and limits file size.
 */

// Define directories for profile and extra images
const PROFILES_DIR = path.join(__dirname, '../uploads/profiles');
const EXTRA_DIR    = path.join(__dirname, '../uploads/extra');

// Ensure upload directories exist
[PROFILES_DIR, EXTRA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage config: choose destination by field name and set unique filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'profilePhoto') {
      cb(null, PROFILES_DIR);
    } else {
      cb(null, EXTRA_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

// Filter: only allow image mimetypes
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname), false);
  }
};

// Limits: max file size per upload
const limits = {
  fileSize: 10 * 1024 * 1024, // 10 MB
};

// Export the configured upload middleware
const upload = multer({ storage, fileFilter, limits });

module.exports = { upload };
