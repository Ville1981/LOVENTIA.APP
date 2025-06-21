const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

// Load environment variables
dotenv.config();

const app = express();

// Import webhook routes (before body parsers)
const stripeWebhookRouter = require("./routes/stripeWebhook");
const paypalWebhookRouter = require("./routes/paypalWebhook");

// Import application routes
const authRoutes     = require("./routes/auth");
const imageRoutes    = require("./routes/imageRoutes");
const userRoutes     = require("./routes/userRoutes");
const messageRoutes  = require("./routes/messageRoutes");
const paymentRoutes  = require("./routes/payment");
const discoverRoutes = require("./routes/discover");

// Stripe webhook endpoint (raw body required for signature verification)
app.use(
  "/api/payment/stripe-webhook",
  stripeWebhookRouter
);

// PayPal webhook endpoint (raw body required for signature verification)
app.use(
  "/api/payment/paypal-webhook",
  paypalWebhookRouter
);

// Common middleware
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5174",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads directory for profile and extra images
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// Mock users endpoint (for development/testing)
app.get("/api/users", (req, res) => {
  const user = {
    _id: "1",
    name: "Bunny",
    age: 45,
    location: "Rayong, Thailand",
    compatibility: 88,
    photos: [
      "/assets/bunny1.jpg",
      "/assets/bunny2.jpg",
      "/assets/bunny3.jpg",
    ],
    youPhoto: "/assets/your-avatar.jpg",
    profilePhoto: "/assets/bunny-avatar.jpg",
    agreeCount: 6,
    disagreeCount: 3,
    findOutCount: 4,
    summary: "Positive mindset, self develop …",
    details: {},
  };
  res.json([user]);
});

// Mount application routes
app.use("/api/auth",    authRoutes);
app.use("/api/users",   imageRoutes);
app.use("/api/users",   userRoutes);
app.use("/api/messages",messageRoutes);
app.use("/api/payment", paymentRoutes);

// Mount Discover (must come after other /api mounts)
app.use("/api/discover", discoverRoutes);

// DEBUG: log all mounted routes
console.log("\n🛣️ Registered routes:");
app._router.stack.forEach(layer => {
  if (layer.route && layer.route.path) {
    const methods = Object.keys(layer.route.methods)
      .map(m => m.toUpperCase()).join(", ");
    console.log(`  ${methods.padEnd(6)} ${layer.route.path}`);
  }
});

// Multer-specific error handler
app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    return res.status(413).json({ error: err.message });
  }
  next(err);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server Error" });
});

module.exports = app;
