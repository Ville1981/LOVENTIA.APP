const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

// Utility: poista tiedosto levyltä
function removeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ✅ Premium-tason aktivointi
const upgradeToPremium = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isPremium = true;
    await user.save();
    res.json({ message: "Premium activated successfully" });
  } catch (err) {
    console.error("Premium upgrade error:", err);
    res.status(500).json({ error: "Server error upgrading to premium" });
  }
};

// ✅ Rekisteröi uusi käyttäjä
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingEmail = await User.findOne({ email });
    const existingUsername = await User.findOne({ username });
    if (existingEmail) return res.status(400).json({ error: "Sähköposti on jo käytössä" });
    if (existingUsername) return res.status(400).json({ error: "Käyttäjänimi on jo varattu" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "Rekisteröinti onnistui" });
  } catch (err) {
    console.error("Rekisteröintivirhe:", err);
    res.status(500).json({ error: "Palvelinvirhe rekisteröinnissä" });
  }
};

// ✅ Kirjaudu sisään
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "30d" });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ token: accessToken });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Etsi ottelut ja laske match-score
const getMatchesWithScore = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    const allUsers = await User.find({ _id: { $ne: currentUser._id } });
    const matches = allUsers
      .filter(u =>
        !currentUser.blockedUsers.includes(u._id) &&
        !u.blockedUsers.includes(currentUser._id)
      )
      .map(u => {
        let score = 0;
        if (
          currentUser.preferredGender === "any" ||
          u.gender?.toLowerCase() === currentUser.preferredGender?.toLowerCase()
        ) score += 20;
        if (
          u.age >= (currentUser.preferredMinAge || 18) &&
          u.age <= (currentUser.preferredMaxAge || 100)
        ) score += 20;
        const common = currentUser.preferredInterests?.filter(i =>
          u.interests?.includes(i)
        );
        score += Math.min((common?.length || 0) * 10, 60);
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          age: u.age,
          gender: u.gender,
          goal: u.goal,
          location: u.location,
          profilePicture: u.profilePicture,
          isPremium: u.isPremium,
          matchScore: score,
        };
      });
    res.json(matches);
  } catch (err) {
    console.error("Match score error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Lisäkuvien lataus (bulk)
const uploadExtraPhotos = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({ error: "No photos uploaded" });
    }

    const maxAllowed = user.isPremium ? 20 : 6;
    if ((user.extraImages?.filter(Boolean).length || 0) + files.length > maxAllowed) {
      return res.status(400).json({ error: `Cannot exceed ${maxAllowed} extra photos` });
    }

    // Poista vanhat jos halutaan korvata, tai lisää perään
    // Tässä korvatakseen: removeFile on jo osa put /profile
    user.extraImages = files.map(f => f.path);
    const saved = await user.save();
    res.json({ extraImages: saved.extraImages });
  } catch (err) {
    console.error("uploadExtraPhotos error:", err);
    res.status(500).json({ error: "Bulk upload failed" });
  }
};

// 🚀 Yksi kuva + slot + crop + caption
const uploadPhotoStep = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const slot = parseInt(req.body.slot, 10);
    if (isNaN(slot)) return res.status(400).json({ error: "Invalid slot" });

    // Poista vanha
    if (user.extraImages[slot]) removeFile(user.extraImages[slot]);
    user.extraImages = user.extraImages || [];
    user.extraImages[slot] = req.file.path;

    const saved = await user.save();
    res.json({ extraImages: saved.extraImages });
  } catch (err) {
    console.error("uploadPhotoStep error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
};

// 🚀 Slot-kohtainen poisto
const deletePhotoSlot = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const slot = parseInt(req.params.slot, 10);
    if (isNaN(slot)) return res.status(400).json({ error: "Invalid slot" });

    if (user.extraImages[slot]) {
      removeFile(user.extraImages[slot]);
      user.extraImages[slot] = null;
    }

    const saved = await user.save();
    res.json({ extraImages: saved.extraImages });
  } catch (err) {
    console.error("deletePhotoSlot error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
};

module.exports = {
  upgradeToPremium,
  registerUser,
  loginUser,
  getMatchesWithScore,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
};
