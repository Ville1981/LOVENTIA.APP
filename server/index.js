// server/index.js

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

// Load environment variables from .env (must be at top)
dotenv.config();

const app = express();

// ── Stripe & PayPal webhooks ───────────────────────────────────────────────────
// These need raw body, so register before express.json()
const stripeWebhookRouter = require("./routes/stripeWebhook");
const paypalWebhookRouter = require("./routes/paypalWebhook");

app.use(
  "/api/payment/stripe-webhook",
  stripeWebhookRouter
);
app.use(
  "/api/payment/paypal-webhook",
  paypalWebhookRouter
);

// ── Common middleware ───────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5174",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Authorization"]
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve uploads folder as static files ────────────────────────────────────────
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ── Mount application routes ────────────────────────────────────────────────────
const authRoutes     = require("./routes/auth");
const imageRoutes    = require("./routes/imageRoutes");
const userRoutes     = require("./routes/userRoutes");
const messageRoutes  = require("./routes/messageRoutes");
const paymentRoutes  = require("./routes/payment");
const discoverRoutes = require("./routes/discover");

app.use("/api/auth",       authRoutes);
// ← swap: userRoutes must come before imageRoutes
app.use("/api/users",      userRoutes);
app.use("/api/users",      imageRoutes);

app.use("/api/messages",   messageRoutes);
app.use("/api/payment",    paymentRoutes);
app.use("/api/discover",   discoverRoutes);

// ── Temporary mock users endpoint (for development/testing) ────────────────────
// NOTE: this is mounted *after* your real /api/users routes, so it won't override them.
app.get("/api/mock-users", (req, res) => {
  const user = {
    _id: "1",
    name: "Bunny",
    age: 45,
    city: "Rayong",
    region: "Chonburi",
    country: "Thailand",
    compatibility: 88,
    photos: [
      "/uploads/bunny1.jpg",
      "/uploads/bunny2.jpg",
      "/uploads/bunny3.jpg",
    ],
    youPhoto: "/uploads/your-avatar.jpg",
    profilePhoto: "/uploads/bunny-avatar.jpg",
    agreeCount: 6,
    disagreeCount: 3,
    findOutCount: 4,
    summary: "Positive mindset, self develop …",
    details: {},
  };
  return res.json([user]);
});

// ── Multer-specific error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    return res.status(413).json({ error: err.message });
  }
  next(err);
});

// ── 404 Not Found handler ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server Error" });
});

// ── Start server & connect to MongoDB ──────────────────────────────────────────
mongoose.set("strictQuery", true);
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    console.log("🛣️ Registered routes:");
    app._router.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .join(", ");
        console.log(`  ${methods.padEnd(6)} ${layer.route.path}`);
      }
    });
    app.listen(PORT, () =>
      console.log(`✅ Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

module.exports = app;
