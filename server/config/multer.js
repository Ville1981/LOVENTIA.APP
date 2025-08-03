// server/config/multer.js

import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * Multer configuration for handling user profile and extra photo uploads.
 * - Separate storage directories for avatars and extra images
 * - Unique, sanitized filenames to avoid collisions
 * - Restrict uploads to image files only (JPG, PNG, GIF)
 * - Enforce file size limits
 */

const PROFILES_DIR = path.join(process.cwd(), 'uploads', 'profiles');
const EXTRA_DIR = path.join(process.cwd(), 'uploads', 'extra');

[PROFILES_DIR, EXTRA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif'];
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Only ${allowedExts.join(', ')} files are allowed`));
  }
};

const limits = {
  fileSize: 10 * 1024 * 1024, // 10 MB
};

// --- REPLACE START: export named `upload` for ESM import ---
export const upload = multer({ storage, fileFilter, limits });
// --- REPLACE END ---
