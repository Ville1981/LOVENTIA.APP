// server/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware"); // varmistetaan oikea nimi

// ✅ Hae kaikki viestit kahden käyttäjän välillä
router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.userId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("❌ Virhe viestien haussa:", err);
    res.status(500).json({ message: "Virhe viestien hakemisessa" });
  }
});

// ✅ Lähetä uusi viesti
router.post("/:userId", authMiddleware, async (req, res) => {
  try {
    const newMessage = new Message({
      sender: req.userId,
      receiver: req.params.userId,
      text: req.body.text,
    });

    const saved = await newMessage.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Virhe viestin lähetyksessä:", err);
    res.status(500).json({ message: "Virhe viestin lähetyksessä" });
  }
});

module.exports = router;
