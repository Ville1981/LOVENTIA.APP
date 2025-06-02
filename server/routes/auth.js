const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { registerUser, loginUser } = require('../controllers/userController');
const upload = require("../middleware/upload");

// ----------------------- 🔐 REFRESH TOKEN REITTI -----------------------
router.post("/refresh", (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: "No refresh token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const accessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    res.json({ accessToken });
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired refresh token" });
  }
});

// ----------------------------------------------------------------------

// Register
router.post('/register', registerUser);

// Login
router.post('/login', loginUser);

// Get current user
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ✅ Update profile with multiple fields and images
router.put("/profile", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "extraImages", maxCount: 6 },
]), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const updateData = {
      name: req.body.name,
      email: req.body.email,
      age: req.body.age,
      height: req.body.height,
      weight: req.body.weight,
      status: req.body.status,
      religion: req.body.religion,
      children: req.body.children,
      pets: req.body.pets,
      summary: req.body.summary,
      goal: req.body.goal,
      lookingFor: req.body.lookingFor,
    };

    // ✅ Profiilikuva
    if (req.files["image"]) {
      updateData.profilePicture = "uploads/" + req.files["image"][0].filename;
    }

    // ✅ Lisäkuvat
    if (req.files["extraImages"]) {
      updateData.extraImages = req.files["extraImages"].map(file => "uploads/" + file.filename);
    }

    const updatedUser = await User.findByIdAndUpdate(decoded.id, updateData, {
      new: true,
    }).select("-password");

    res.json(updatedUser);
  } catch (err) {
    console.error("Profiilin päivitysvirhe:", err);
    res.status(401).json({ error: "Invalid token" });
  }
});

// Delete account
router.delete("/delete", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await User.findByIdAndDelete(decoded.id);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
