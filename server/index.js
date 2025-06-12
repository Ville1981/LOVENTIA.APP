// server/index.js

const app      = require("./app");
const mongoose = require("mongoose");
require("dotenv").config();

const PORT = process.env.PORT || 5000;

// 🔌 MongoDB-yhteys ja palvelimen käynnistys
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () =>
      console.log(`✅ Server running on http://localhost:${PORT}`)
    );
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));
