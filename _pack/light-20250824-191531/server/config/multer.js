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

// Ensure base upload folders exist (idempotent)
const PROFILES_DIR = path.join(process.cwd(), 'uploads', 'profiles');
const EXTRA_DIR    = path.join(process.cwd(), 'uploads', 'extra');

[PROFILES_DIR, EXTRA_DIR].forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Keep a clear server log if directory creation fails
    console.error(`[multer] Failed to ensure upload dir: ${dir}`, e);
  }
});

// Disk storage with field-based routing
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    // Route avatar uploads to /uploads/profiles, everything else to /uploads/extra
    if (file?.fieldname === 'profilePhoto') {
      cb(null, PROFILES_DIR);
    } else {
      cb(null, EXTRA_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname || '').toLowerCase();
    const base = path
      .basename(file.originalname || 'upload', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80); // keep names short & safe for most filesystems
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});

// Accept only image files
const fileFilter = (_req, file, cb) => {
  const ext       = path.extname(file.originalname || '').toLowerCase();
  const allowed   = ['.jpg', '.jpeg', '.png', '.gif'];
  const isAllowed = allowed.includes(ext);

  if (isAllowed) {
    return cb(null, true);
  }

  // Use MulterError so our global multer error handler can respond with 413/400 cleanly
  const err = new multer.MulterError(
    'LIMIT_UNEXPECTED_FILE',
    `Only ${allowed.join(', ')} files are allowed`
  );
  return cb(err);
};

// Reasonable limits; keep aligned with front-end constraints
const limits = {
  fileSize: 10 * 1024 * 1024, // 10 MB
};

// --- REPLACE START: export named `upload` for ESM import ---
export const upload = multer({ storage, fileFilter, limits });
// --- REPLACE END ---
