// server/app.js

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

// Load environment variables
dotenv.config();

const app = express();

// Import webhook routes before body parsers
const stripeWebhookRouter = require("./routes/stripeWebhook");
const paypalWebhookRouter = require("./routes/paypalWebhook");

// Stripe webhook endpoint (raw body required for signature verification)
app.use(
  "/api/payment/stripe-webhook",
  stripeWebhookRouter
);

// PayPal webhook endpoint (raw body required for signature verification)
app.use(
  "/api",
  paypalWebhookRouter
);

// Common middleware
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5174",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads directory
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// 🔌 Application routes
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/auth");
const imageRoutes = require("./routes/imageRoutes");
const messageRoutes = require("./routes/messageRoutes");
const paymentRoutes = require("./routes/payment");

// Mock discover endpoint
app.get("/api/users", (req, res) => {
  const user = {
    _id: "1",
    name: "Bunny",
    age: 45,
    location: "Rayong, Thailand",
    compatibility: 88,
    photos: [
      "/uploads/profiles/bunny1.jpg",
      "/uploads/profiles/bunny2.jpg",
      "/uploads/profiles/bunny3.jpg",
    ],
    youPhoto: "/uploads/profiles/your-avatar.jpg",
    profilePhoto: "/uploads/profiles/bunny-avatar.jpg",
    agreeCount: 6,
    disagreeCount: 3,
    findOutCount: 4,
    summary: "Positive mindset, self develop …",
    details: {},
  };
  res.json([user]);
});

// Mount API routers
app.use("/api/users", userRoutes);     // ← korjattu mount: profiili- ja user-API:t
app.use("/api/auth", authRoutes);
// Image upload routes: avatar and extra photos
app.use("/api/users", imageRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/payment", paymentRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: "Not Found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

module.exports = app;
