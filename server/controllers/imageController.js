const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const Image = require('../models/Image');
const User = require('../models/User');

/**
 * Controllers for handling image uploads, cropping, and deletions.
 */

/**
 * Replace existing avatar image.
 */
exports.uploadAvatar = async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Remove old avatar records and files
    const oldAvatars = await Image.find({ owner: userId, isAvatar: true });
    await Promise.all(
      oldAvatars.map(async (old) => {
        const fileOnDisk = path.join(
          __dirname,
          '..',
          old.url.replace(/^\//, '')
        );
        fs.unlink(fileOnDisk, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.warn('Could not delete old avatar:', err.code, fileOnDisk);
          }
        });
        await Image.deleteOne({ _id: old._id });
      })
    );

    // Save new avatar record
    const avatarUrl = `/uploads/profiles/${req.file.filename}`;
    await Image.create({
      owner: userId,
      url: avatarUrl,
      uploaded: new Date(),
      isAvatar: true,
    });

    // Update user's profilePicture
    const user = await User.findById(userId);
    user.profilePicture = avatarUrl;
    await user.save();

    return res.status(200).json({ profilePicture: avatarUrl });
  } catch (err) {
    console.error('Upload avatar error:', err);
    return res.status(500).json({ error: 'Avatar upload failed' });
  }
};

/**
 * Bulk upload extra images.
 */
exports.uploadPhotos = async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Free tier now gets 7 slots
    const maxSlots = user.isPremium ? 20 : 7;
    const existing = Array.isArray(user.extraImages)
      ? [...user.extraImages]
      : [];
    const files = req.files || [];

    if (existing.filter(Boolean).length + files.length > maxSlots) {
      return res
        .status(400)
        .json({ error: `Max ${maxSlots} extra images allowed` });
    }

    const updated = Array.from(
      { length: maxSlots },
      (_, i) => existing[i] || null
    );
    for (const file of files) {
      const url = `/uploads/extra/${file.filename}`;
      const idx = updated.findIndex((img) => !img);
      if (idx === -1) break;
      updated[idx] = url;
      await Image.create({
        owner: userId,
        url,
        uploaded: new Date(),
        isAvatar: false,
      });
    }

    user.extraImages = updated;
    await user.save();

    // Return full array (including nulls)
    return res.status(200).json({
      extraImages: updated
    });
  } catch (err) {
    console.error('Bulk upload error:', err);
    return res.status(500).json({ error: 'Photos upload failed' });
  }
};

/**
 * Single image upload with crop and optional caption.
 */
exports.uploadPhotoStep = async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { slot, cropX, cropY, cropWidth, cropHeight, caption } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const maxSlots = user.isPremium ? 20 : 7;
    const arr = Array.isArray(user.extraImages)
      ? [...user.extraImages]
      : Array(maxSlots).fill(null);

    // GIF bypass
    if (req.file.mimetype === 'image/gif') {
      const gifUrl = `/uploads/extra/${req.file.filename}`;
      const idxGif =
        Number.isInteger(+slot) && +slot >= 0 && +slot < maxSlots
          ? +slot
          : arr.findIndex((i) => !i);
      if (idxGif !== -1) arr[idxGif] = gifUrl;
      await Image.create({
        owner: userId,
        url: gifUrl,
        uploaded: new Date(),
        isAvatar: false,
        caption,
      });
      user.extraImages = arr;
      await user.save();
      // Return full array
      return res.status(200).json({
        extraImages: arr
      });
    }

    // Crop with Sharp
    const inPath = path.join(
      __dirname,
      '..',
      'uploads',
      'extra',
      req.file.filename
    );
    const outName = `crop_${Date.now()}_${req.file.filename}`;
    const outPath = path.join(
      __dirname,
      '..',
      'uploads',
      'extra',
      outName
    );

    await sharp(inPath)
      .extract({
        left: +cropX,
        top: +cropY,
        width: +cropWidth,
        height: +cropHeight,
      })
      .toFile(outPath);
    fs.unlink(inPath, (e) =>
      e && e.code !== 'ENOENT' && console.warn('Temp unlink failed', e)
    );

    const url = `/uploads/extra/${outName}`;
    const idxCrop =
      Number.isInteger(+slot) && +slot >= 0 && +slot < maxSlots
        ? +slot
        : arr.findIndex((i) => !i);
    if (idxCrop !== -1) arr[idxCrop] = url;
    await Image.create({
      owner: userId,
      url,
      uploaded: new Date(),
      isAvatar: false,
      caption,
    });

    user.extraImages = arr;
    await user.save();
    // Return full array
    return res.status(200).json({
      extraImages: arr
    });
  } catch (err) {
    console.error('Step upload error:', err);
    return res.status(500).json({ error: 'Step upload failed' });
  }
};

/**
 * Delete an image in a specified slot.
 */
exports.deletePhotoSlot = async (req, res) => {
  try {
    const { userId, slot } = req.params;
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const idx = parseInt(slot, 10);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const maxSlots = user.isPremium ? 20 : 7;
    const arr = Array.isArray(user.extraImages)
      ? [...user.extraImages]
      : Array(maxSlots).fill(null);

    if (idx < 0 || idx >= arr.length) {
      return res.status(400).json({ error: 'Invalid slot index' });
    }

    const imageUrl = arr[idx];
    if (imageUrl) {
      const filePath = path.join(
        __dirname,
        '..',
        imageUrl.replace(/^\//, '')
      );
      fs.unlink(filePath, (e) =>
        e && e.code !== 'ENOENT' && console.warn('Deletion failed', e)
      );
      await Image.deleteOne({ owner: userId, url: imageUrl });
    }

    arr[idx] = null;
    user.extraImages = arr;
    await user.save();
    // Return full array
    return res.status(200).json({
      extraImages: arr
    });
  } catch (err) {
    console.error('Delete slot error:', err);
    return res.status(500).json({ error: 'Failed to delete photo slot' });
  }
};
