<<<<<<< HEAD
// server/index.js

=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

<<<<<<< HEAD
// Load environment variables from .env (must be at top)
=======
// Load environment variables from .env
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
dotenv.config();

const app = express();

// ── Stripe & PayPal webhooks ───────────────────────────────────────────────────
<<<<<<< HEAD
// These need raw body, so register before express.json()
=======
// These need to see the raw body, so they must be registered *before* express.json()
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
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
<<<<<<< HEAD
    exposedHeaders: ["Authorization"]
=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
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
<<<<<<< HEAD
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

=======
const authRoutes    = require("./routes/auth");
const imageRoutes   = require("./routes/imageRoutes");
const userRoutes    = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const paymentRoutes = require("./routes/payment");
const discoverRoutes = require("./routes/discover");

app.use("/api/auth",       authRoutes);
app.use("/api/users",      imageRoutes);
app.use("/api/users",      userRoutes);
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
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
<<<<<<< HEAD
app.use((req, res) => {
=======
app.use((req, res, next) => {
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
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
<<<<<<< HEAD
    app._router.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .join(", ");
=======
    app._router.stack.forEach(layer => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods)
          .map(m => m.toUpperCase()).join(", ");
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
        console.log(`  ${methods.padEnd(6)} ${layer.route.path}`);
      }
    });
    app.listen(PORT, () =>
      console.log(`✅ Server running on http://localhost:${PORT}`)
    );
  })
<<<<<<< HEAD
  .catch((err) => console.error("❌ MongoDB connection error:", err));
=======
  .catch(err => console.error("❌ MongoDB connection error:", err));
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678

module.exports = app;
