// --- REPLACE START: images service (uploadExtraPhotos, uploadPhotoStep, deletePhotoSlot) ---
import fs from 'fs';
import path from 'path';

import * as UserModule from '../../src/models/User.js';
const User = UserModule.default || UserModule;

function removeFile(filePath) {
  if (!filePath) return;
  try {
    const p = path.resolve(filePath);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (err) {
    if (err?.code !== 'ENOENT') console.warn('removeFile warning:', err?.message || err);
  }
}

export async function uploadExtraPhotosService(req, res) {
  try {
    const uid = req?.user?.userId || req?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const files = req.files || [];
    const maxAllowed = user.isPremium ? 20 : 6;

    if ((user.extraImages?.length || 0) + files.length > maxAllowed) {
      return res
        .status(400)
        .json({ error: `Max ${maxAllowed} images allowed` });
    }

    files.forEach((f) => {
      if (!user.extraImages) user.extraImages = [];
      user.extraImages.push(f.path);
    });

    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error('uploadExtraPhotos error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during photo upload' });
  }
}

export async function uploadPhotoStepService(req, res) {
  try {
    const uid = req?.user?.userId || req?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const slot = parseInt(req.body?.slot, 10);
    if (Number.isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    if (!user.extraImages) user.extraImages = [];

    if (user.extraImages[slot]) removeFile(user.extraImages[slot]);
    user.extraImages[slot] = req.file?.path;

    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error('uploadPhotoStep error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during photo step upload' });
  }
}

export async function deletePhotoSlotService(req, res) {
  try {
    const uid = req?.user?.userId || req?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const slot = parseInt(req.params?.slot, 10);
    if (Number.isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    if (!user.extraImages) user.extraImages = [];

    if (user.extraImages[slot]) {
      removeFile(user.extraImages[slot]);
      user.extraImages[slot] = null;
    }
    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error('deletePhotoSlot error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during photo deletion' });
  }
}
// --- REPLACE END ---
