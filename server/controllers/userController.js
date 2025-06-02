// server/controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ✅ Premium-tason aktivointi
const upgradeToPremium = async (req, res) => {
  try {
    console.log("🟡 Premium-pyyntö käyttäjältä:", req.userId);

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized – no user ID in token" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isPremium = true;
    await user.save();

    console.log("✅ Premium aktivoitu käyttäjälle:", user.username);
    res.json({ message: "Premium activated successfully" });
  } catch (err) {
    console.error("❌ Premium upgrade error:", err);
    res.status(500).json({ error: "Server error upgrading to premium" });
  }
};

// ✅ Muu sisältö: (rekisteröinti, login, matchit...)
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

const getMatchesWithScore = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    const allUsers = await User.find({ _id: { $ne: currentUser._id } });

    const matches = allUsers
      .filter((user) =>
        !currentUser.blockedUsers.includes(user._id) &&
        !user.blockedUsers.includes(currentUser._id)
      )
      .map((user) => {
        let score = 0;
        if (
          currentUser.preferredGender === "any" ||
          user.gender?.toLowerCase() === currentUser.preferredGender?.toLowerCase()
        )
          score += 20;

        if (
          user.age >= (currentUser.preferredMinAge || 18) &&
          user.age <= (currentUser.preferredMaxAge || 100)
        )
          score += 20;

        const commonInterests = currentUser.preferredInterests?.filter((interest) =>
          user.interests?.includes(interest)
        );
        score += Math.min((commonInterests?.length || 0) * 10, 60);

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          age: user.age,
          gender: user.gender,
          goal: user.goal,
          location: user.location,
          profilePicture: user.profilePicture,
          isPremium: user.isPremium || false,
          matchScore: score,
        };
      });

    res.json(matches);
  } catch (err) {
    console.error("Match score error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
};
