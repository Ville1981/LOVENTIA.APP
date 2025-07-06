const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

// Configuration
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

// Utility: remove a file from disk
function removeFile(filePath) {
  if (!filePath) return;
  try {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`Failed to remove file ${filePath}: ${err.message}`);
  }
}

// Register a new user with hashed password
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "Sähköposti on jo käytössä" });
    }
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: "Käyttäjänimi on jo varattu" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    return res.status(201).json({
      message: "Rekisteröinti onnistui",
      user: { id: newUser._id, username: newUser.username, email: newUser.email },
    });
  } catch (err) {
    console.error(`Rekisteröintivirhe: ${err.message}`);
    return res.status(500).json({ error: "Palvelinvirhe rekisteröinnissä" });
  }
};

// Log in a user by comparing password and issuing tokens
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Virheelliset kirjautumistiedot" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Virheelliset kirjautumistiedot" });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken,
      user: { id: user._id, username: user.username, email: user.email, isPremium: user.isPremium, role: user.role },
    });
  } catch (err) {
    console.error(`Login error: ${err.message}`);
    return res.status(500).json({ error: "Palvelinvirhe kirjautumisessa" });
  }
};

// Activate premium status for the user
const upgradeToPremium = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "Käyttäjää ei löydy" });
    }

    user.isPremium = true;
    await user.save();
    return res.json({ message: "Premium-tila aktivoitu onnistuneesti" });
  } catch (err) {
    console.error(`Premium upgrade error: ${err.message}`);
    return res.status(500).json({ error: "Palvelinvirhe premium-päivityksessä" });
  }
};

// Get possible matches with a computed score
const getMatchesWithScore = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ error: "Käyttäjää ei löydy" });
    }

    const blockedByMe = Array.isArray(currentUser.blockedUsers) ? currentUser.blockedUsers : [];
    const interests = Array.isArray(currentUser.preferredInterests) ? currentUser.preferredInterests : [];

    const allUsers = await User.find({ _id: { $ne: currentUser._id } });
    let matches = allUsers
      .filter(u => {
        const blockedThem = Array.isArray(u.blockedUsers) ? u.blockedUsers : [];
        return !blockedByMe.includes(u._id) && !blockedThem.includes(currentUser._id);
      })
      .map(u => {
        let score = 0;
        if (
          currentUser.preferredGender === "any" ||
          (u.gender && u.gender.toLowerCase() === currentUser.preferredGender?.toLowerCase())
        ) score += 20;
        if (
          u.age >= (currentUser.preferredMinAge || 18) &&
          u.age <= (currentUser.preferredMaxAge || 100)
        ) score += 20;
        const userInterests = Array.isArray(u.interests) ? u.interests : [];
        const common = interests.filter(i => userInterests.includes(i));
        score += Math.min(common.length * 10, 60);

        return {
          id: u._id,
          username: u.username,
          email: u.email,
          age: u.age,
          gender: u.gender,
          location: u.location,
          profilePicture: u.profilePicture,
          isPremium: u.isPremium,
          matchScore: score,
        };
      });

    // Sort by matchScore descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return res.json(matches);
  } catch (err) {
    console.error(`Match score error: ${err.message}`);
    return res.status(500).json({ error: "Palvelinvirhe ottelujen haussa" });
  }
};

// Bulk upload extra photos
const uploadExtraPhotos = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "Käyttäjää ei löydy" });
    }

    const files = req.files;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "Kuvia ei ladattu" });
    }

    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];
    const existingCount = user.extraImages.filter(Boolean).length;
    const maxAllowed = user.isPremium ? 20 : 6;
    if (existingCount + files.length > maxAllowed) {
      return res.status(400).json({ error: `Kuvien enimmäismäärä on ${maxAllowed}` });
    }

    files.forEach(f => user.extraImages.push(f.path));
    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error(`uploadExtraPhotos error: ${err.message}`);
    return res.status(500).json({ error: "Palvelinvirhe kuvien latauksessa" });
  }
};

// Upload single photo into a slot
const uploadPhotoStep = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "Käyttäjää ei löydy" });
    }

    const slot = parseInt(req.body.slot, 10);
    if (isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: "Virheellinen slot" });
    }

    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];
    if (user.extraImages[slot]) removeFile(user.extraImages[slot]);

    user.extraImages[slot] = req.file.path;
    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error(`uploadPhotoStep error: ${err.message}`);
    return res.status(500).json({ error: "Palvelinvirhe yksittäisessä kuvassa" });
  }
};

// Delete a specific photo slot
const deletePhotoSlot = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "Käyttäjää ei löydy" });
    }

    const slot = parseInt(req.params.slot, 10);
    if (isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: "Virheellinen slot" });
    }

    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];
    if (user.extraImages[slot]) {
      removeFile(user.extraImages[slot]);
      user.extraImages[slot] = null;
    }

    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error(`deletePhotoSlot error: ${err.message}`);
    return res.status(500).json({ error: "Palvelinvirhe slotin poistoissa" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  upgradeToPremium,
  getMatchesWithScore,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
};
