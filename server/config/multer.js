// server/config/multer.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Multer configuration for handling user profile and extra photo uploads.
 * - Separate storage directories for avatars and extra images
 * - Unique, sanitized filenames to avoid collisions
 * - Restrict uploads to image files only (JPG, PNG, GIF)
 * - Enforce file size limits
 */

// Define absolute paths for upload directories
const PROFILES_DIR = path.join(__dirname, '../uploads/profiles');
const EXTRA_DIR = path.join(__dirname, '../uploads/extra');

// Ensure upload directories exist
[PROFILES_DIR, EXTRA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage engine: choose destination by fieldname and assign unique, sanitized filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 'profilePhoto' goes to profiles; everything else (photo/photos) to extra
    if (file.fieldname === 'profilePhoto') {
      cb(null, PROFILES_DIR);
    } else {
      cb(null, EXTRA_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Sanitize base name: allow letters, numbers, underscore, dash
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});

// File filter: only accept common image types (including GIF for bypass)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif'];
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Only ${allowedExts.join(', ')} files are allowed`
      )
    );
  }
};

// Upload limits
const limits = {
  fileSize: 10 * 1024 * 1024, // 10 MB max per file
};

// Export configured multer middleware
const upload = multer({ storage, fileFilter, limits });

module.exports = { upload };
