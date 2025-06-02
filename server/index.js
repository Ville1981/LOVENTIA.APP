// server/index.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

dotenv.config();

// 🔌 Reitit
const userRoutes = require("./routes/user"); // ✅ pienellä!
const messageRoutes = require("./routes/messageRoutes");
const paymentRoutes = require("./routes/payment");

const app = express();
const PORT = process.env.PORT || 5000;

// 🌐 Middlewaret
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:5174", // kehitysympäristön frontend
  credentials: true,
}));
app.use(express.json()); // JSON-pyynnöt
app.use(express.urlencoded({ extended: true })); // 🔧 tukee FormData-tekstikenttiä

// 📸 Staattinen kuvasisältö selaimelle
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 🛠 API-reitit
app.use("/api/user", userRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/payment", paymentRoutes);

// 🔌 MongoDB-yhteys
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () =>
      console.log(`✅ Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
