// PATH: server/services/imagesService.js

// --- REPLACE START: images service (uploadExtraPhotos, uploadPhotoStep, deletePhotoSlot) ---
import fs from 'fs';
import path from 'path';

import * as UserModule from '../../src/models/User.js';
const User = UserModule.default || UserModule;

/**
 * Normalize a filesystem path to a web path with forward slashes and no leading "./".
 * Keeps relative "uploads/..." style used by the API & client.
 */
function toWebPath(p) {
  if (!p || typeof p !== 'string') return p;
  let s = p.replace(/\\\\/g, '/').replace(/\\/g, '/');
  if (s.startsWith('./')) s = s.slice(2);
  if (s.startsWith('/')) s = s.slice(1);
  return s;
}

/**
 * Ensure "uploads" and subfolders exist to avoid ENOENT on Windows/Linux.
 * Returns absolute dir path.
 */
function ensureDir(dirRel) {
  const abs = path.resolve(dirRel);
  try {
    if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  } catch (e) {
    // Non-fatal; multer may still create the target leaf dir on write, but we try eagerly.
    console.warn('ensureDir warning:', e?.message || e);
  }
  return abs;
}

/**
 * Best-effort file remover (swallows ENOENT).
 */
function removeFile(filePath) {
  if (!filePath) return;
  try {
    const abs = path.resolve(filePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (err) {
    if (err?.code !== 'ENOENT') console.warn('removeFile warning:', err?.message || err);
  }
}

/**
 * Derive authenticated user id from typical places set by our auth middleware.
 */
function getUid(req) {
  return req?.user?.id || req?.user?.userId || req?.userId || null;
}

/**
 * Optional: if route uses /users/:id/... verify the path param matches the auth user.
 * Returns a string error (to send) or null if OK.
 */
function requireSameUser(req, uid) {
  const paramId = req?.params?.id || req?.params?.userId || null;
  if (!paramId) return null; // not a param-bound route, OK
  if (String(paramId) !== String(uid)) return 'Forbidden';
  return null;
}

/**
 * Resolve max image slots based on premium flag.
 * Keep this consistent with server/routes/user.js (50 vs 9).
 */
function getMaxSlots(user) {
  return user?.isPremium ? 50 : 9;
}

/**
 * Expand or trim an images array to exactly maxSlots length with null placeholders.
 */
function normalizeSlots(list, maxSlots) {
  const arr = Array.isArray(list) ? list.slice(0, maxSlots) : [];
  while (arr.length < maxSlots) arr.push(null);
  return arr.map((x) => (x ? toWebPath(x) : null));
}

/**
 * Convert any array of paths to normalized forward-slash web paths.
 */
function normalizePaths(list) {
  return (Array.isArray(list) ? list : []).map((p) => (p ? toWebPath(p) : p));
}

/**
 * Ensure base upload dirs exist on service load.
 */
ensureDir('uploads');
ensureDir(path.join('uploads', 'extra'));
ensureDir(path.join('uploads', 'avatars'));
ensureDir(path.join('uploads', 'profiles'));

/**
 * Bulk upload handler: appends new photos until maxSlots, preserving existing ones.
 * Responds with { extraImages: string[] } using normalized forward-slash paths.
 */
export async function uploadExtraPhotosService(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const forbid = requireSameUser(req, uid);
    if (forbid) return res.status(403).json({ error: forbid });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const maxSlots = getMaxSlots(user);
    const files = Array.isArray(req.files) ? req.files : [];
    const current = normalizeSlots(user.extraImages, maxSlots);

    const emptyIdx = [];
    for (let i = 0; i < current.length; i++) {
      if (!current[i]) emptyIdx.push(i);
    }

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (files.length > emptyIdx.length) {
      return res.status(400).json({ error: `Max ${maxSlots} extra images allowed` });
    }

    // Push files into first available empty slots
    for (let i = 0; i < files.length; i++) {
      const slot = emptyIdx[i];
      const rel = toWebPath(files[i].path);
      current[slot] = rel;
    }

    user.extraImages = current;
    await user.save();

    return res.json({ extraImages: normalizePaths(user.extraImages) });
  } catch (err) {
    console.error('uploadExtraPhotos error:', err);
    return res.status(500).json({ error: 'Server error during photo upload' });
  }
}

/**
 * Step upload: replaces a specific slot (with optional prior crop step already applied by controller/middleware).
 * Body: slot (number). File in req.file.
 * Responds with { extraImages: string[] } (normalized).
 */
export async function uploadPhotoStepService(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const forbid = requireSameUser(req, uid);
    if (forbid) return res.status(403).json({ error: forbid });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const maxSlots = getMaxSlots(user);
    const slot = Number.parseInt(req?.body?.slot, 10);
    if (!Number.isInteger(slot) || slot < 0 || slot >= maxSlots) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Ensure slot array shape
    const current = normalizeSlots(user.extraImages, maxSlots);

    // Remove old file for that slot if present
    const oldRel = current[slot];
    if (oldRel) removeFile(path.join(process.cwd(), oldRel));

    // Save new
    current[slot] = toWebPath(req.file.path);

    user.extraImages = current;
    await user.save();

    return res.json({ extraImages: normalizePaths(user.extraImages) });
  } catch (err) {
    console.error('uploadPhotoStep error:', err);
    return res.status(500).json({ error: 'Server error during photo step upload' });
  }
}

/**
 * Delete by slot: sets slot to null and deletes file if exists.
 * Responds with { extraImages: string[] } (normalized).
 */
export async function deletePhotoSlotService(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const forbid = requireSameUser(req, uid);
    if (forbid) return res.status(403).json({ error: forbid });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const maxSlots = getMaxSlots(user);
    const slot = Number.parseInt(req?.params?.slot, 10);
    if (!Number.isInteger(slot) || slot < 0 || slot >= maxSlots) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    const current = normalizeSlots(user.extraImages, maxSlots);

    const rel = current[slot];
    if (rel) {
      // Remove file on disk; allow failure silently if already gone
      removeFile(path.join(process.cwd(), rel));
      current[slot] = null;
    }

    user.extraImages = current;
    await user.save();

    return res.json({ extraImages: normalizePaths(user.extraImages) });
  } catch (err) {
    console.error('deletePhotoSlot error:', err);
    return res.status(500).json({ error: 'Server error during photo deletion' });
  }
}
// --- REPLACE END ---
