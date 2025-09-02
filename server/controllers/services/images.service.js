// PATH: server/services/imagesService.js

// --- REPLACE START: images service (uploadExtraPhotos, uploadPhotoStep, deletePhotoSlot) ---
import fs from 'fs';
import path from 'path';

import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

/**
 * Normalize a filesystem path to a web path with forward slashes and leading "/".
 * Keeps "uploads/..." style used by the API & client.
 */
function toWebPath(p) {
  if (!p || typeof p !== 'string') return p;
  let s = p.replace(/\\\\/g, '/').replace(/\\/g, '/');
  if (s.startsWith('./')) s = s.slice(2);
  if (!s.startsWith('uploads/')) s = s.replace(/^\/+/, '');
  return `/${s}`;
}

/**
 * Ensure directories exist to avoid ENOENT errors.
 */
function ensureDir(dirRel) {
  const abs = path.resolve(dirRel);
  try {
    if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  } catch (e) {
    console.warn('[imagesService] ensureDir warning:', e?.message || e);
  }
  return abs;
}

/**
 * Remove file from disk (best-effort).
 */
function removeFile(filePath) {
  if (!filePath) return;
  try {
    const abs = path.resolve(filePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn('[imagesService] removeFile warning:', err?.message || err);
    }
  }
}

/**
 * Get authenticated user id.
 */
function getUid(req) {
  return req?.user?.id || req?.user?.userId || req?.userId || null;
}

/**
 * Ensure path param id matches authenticated user id.
 */
function requireSameUser(req, uid) {
  const paramId = req?.params?.id || req?.params?.userId || null;
  if (!paramId) return null;
  if (String(paramId) !== String(uid)) return 'Forbidden';
  return null;
}

/**
 * Premium users get 50 slots, free users 9.
 */
function getMaxSlots(user) {
  return user?.isPremium ? 50 : 9;
}

/**
 * Ensure array is length maxSlots and normalized to web paths.
 * NOTE: This returns a fixed-length array (nulls for empty slots) so slot indexes remain stable.
 */
function normalizeSlots(list, maxSlots) {
  const arr = Array.isArray(list) ? list.slice(0, maxSlots) : [];
  while (arr.length < maxSlots) arr.push(null);
  return arr.map((x) => (x ? toWebPath(x) : null));
}

/**
 * Normalize array of paths (keeps nulls for slots, filters only non-strings).
 */
function normalizePaths(list) {
  return (Array.isArray(list) ? list : []).map((p) => (p ? toWebPath(p) : p));
}

/** Drop falsy entries (used to build mirror list for `photos`) */
function compact(list) {
  return (Array.isArray(list) ? list : []).filter(Boolean);
}

/**
 * Return normalized user object for responses.
 * - photos mirrors extraImages but without nulls
 * - profile picture is normalized
 */
function normalizedUser(user) {
  const plain = user.toObject ? user.toObject() : { ...user };
  plain.extraImages = normalizePaths(plain.extraImages);
  if (plain.profilePicture) plain.profilePicture = toWebPath(plain.profilePicture);
  if (plain.profilePhoto) plain.profilePhoto = toWebPath(plain.profilePhoto);
  // Mirror photos <-> extraImages in outgoing payload (no nulls in photos)
  plain.photos = compact(plain.extraImages);
  return plain;
}

// Ensure base upload dirs exist
ensureDir('uploads');
ensureDir(path.join('uploads', 'extra'));
ensureDir(path.join('uploads', 'avatars'));
ensureDir(path.join('uploads', 'profiles'));

/**
 * Bulk upload photos.
 * - Fills first available empty slots (nulls) in extraImages
 * - Mirrors to photos (without nulls)
 * - Updates profilePicture to slot-0 (first non-null) if needed
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

    for (let i = 0; i < files.length; i++) {
      const slot = emptyIdx[i];
      const rel = toWebPath(files[i].path);
      current[slot] = rel;
    }

    // Persist slot array
    user.extraImages = current;
    // Mirror: photos without nulls
    user.photos = compact(current);

    // Keep avatar at slot-0 image if missing/different
    const first = user.photos[0] || null;
    if (first && toWebPath(user.profilePicture || '') !== first) {
      user.profilePicture = first;
    }

    await user.save();

    return res.json({ user: normalizedUser(user) });
  } catch (err) {
    console.error('[imagesService] uploadExtraPhotos error:', err);
    return res.status(500).json({ error: 'Server error during photo upload' });
  }
}

/**
 * Step upload single photo slot.
 * - Replaces specific slot in extraImages
 * - Mirrors to photos (without nulls)
 * - If slot 0 changed, updates profilePicture to slot-0
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

    const current = normalizeSlots(user.extraImages, maxSlots);

    const oldRel = current[slot];
    if (oldRel) removeFile(path.join(process.cwd(), oldRel));

    current[slot] = toWebPath(req.file.path);

    user.extraImages = current;
    // Mirror: photos without nulls
    user.photos = compact(current);

    // Keep avatar in sync with slot-0
    if (slot === 0) {
      const first = user.photos[0] || null;
      user.profilePicture = first || null;
    } else if (!user.profilePicture) {
      const first = user.photos[0] || null;
      if (first) user.profilePicture = first;
    }

    await user.save();

    return res.json({ user: normalizedUser(user) });
  } catch (err) {
    console.error('[imagesService] uploadPhotoStep error:', err);
    return res.status(500).json({ error: 'Server error during photo step upload' });
  }
}

/**
 * Delete photo by slot.
 * - Clears the slot to null in extraImages (stable indexing)
 * - Mirrors to photos (without nulls)
 * - If slot-0 removed, profilePicture becomes new slot-0 (or cleared)
 * - Accepts both /:slot and ?slot=/index= shims
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
    // Accept both req.params.slot and shimmed req.query.slot/index
    const slotRaw = req?.params?.slot ?? req?.query?.slot ?? req?.query?.index;
    const slot = Number.parseInt(slotRaw, 10);
    if (!Number.isInteger(slot) || slot < 0 || slot >= maxSlots) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    const current = normalizeSlots(user.extraImages, maxSlots);

    const rel = current[slot];
    if (rel) {
      removeFile(path.join(process.cwd(), rel));
      current[slot] = null;
    }

    user.extraImages = current;
    // Mirror: photos without nulls
    user.photos = compact(current);

    // Update avatar if first image changed
    const newFirst = user.photos[0] || null;
    user.profilePicture = newFirst || null;

    await user.save();

    return res.json({ user: normalizedUser(user) });
  } catch (err) {
    console.error('[imagesService] deletePhotoSlot error:', err);
    return res.status(500).json({ error: 'Server error during photo deletion' });
  }
}
// --- REPLACE END ---
