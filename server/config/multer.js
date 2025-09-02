// PATH: server/config/multer.js

// --- REPLACE START: core imports ---
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// --- REPLACE END ---

/**
 * Multer configuration for handling user profile and extra photo uploads.
 * - Separate storage directories for avatars and extra images
 * - Unique, sanitized filenames to avoid collisions
 * - Restrict uploads to image files only (JPG, PNG, WEBP, GIF)
 * - Enforce file size limits (10 MB)
 */

// --- REPLACE START: ensure upload directories exist (profiles & extra) ---
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
// --- REPLACE END ---

// --- REPLACE START: disk storage with field-based routing ---
/**
 * Destination:
 *  - field "profilePhoto" → uploads/profiles
 *  - all others (e.g., "photos", "photo", "extraImages") → uploads/extra
 *
 * Filename:
 *  - <sanitized-original-base>-<unique>.ext
 */
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file?.fieldname === 'profilePhoto') {
      cb(null, PROFILES_DIR);
    } else {
      cb(null, EXTRA_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext  = path.extname(file?.originalname || '').toLowerCase();
    const base = path
      .basename(file?.originalname || 'upload', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80); // keep names short & safe for most filesystems
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});
// --- REPLACE END ---

// --- REPLACE START: file filter (images only: jpg/png/webp/gif) ---
const fileFilter = (_req, file, cb) => {
  const ext       = path.extname(file?.originalname || '').toLowerCase();
  const mime      = (file?.mimetype || '').toLowerCase();
  const allowedExts  = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  const okByExt  = allowedExts.includes(ext);
  const okByMime = allowedMimes.includes(mime);

  if (okByExt || okByMime) {
    return cb(null, true);
  }

  // Use MulterError so our global multer error handler can respond cleanly
  const err = new multer.MulterError(
    'LIMIT_UNEXPECTED_FILE',
    `Only image files are allowed (${allowedExts.join(', ')})`
  );
  return cb(err);
};
// --- REPLACE END ---

// --- REPLACE START: limits (10 MB per file) ---
const limits = {
  fileSize: 10 * 1024 * 1024, // 10 MB
};
// --- REPLACE END ---

// --- REPLACE START: export named `upload` (and default for interop) ---
export const upload = multer({ storage, fileFilter, limits });
export default upload;
// --- REPLACE END ---
