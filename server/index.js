const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

// load .env into process.env
dotenv.config();

const app = express();

// ── Stripe & PayPal webhooks ───────────────────────────────────────────────────
// These need to see the raw body, so they must be registered *before* express.json()
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
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve your uploads folder as static files ─────────────────────────────────
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ── API routes ────────────────────────────────────────────────────────────────
const authRoutes    = require("./routes/auth");
const imageRoutes   = require("./routes/imageRoutes");
const userRoutes    = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const paymentRoutes = require("./routes/payment");
const discoverRoutes = require("./routes/discover");

app.use("/api/auth",       authRoutes);
app.use("/api/users",      imageRoutes);
app.use("/api/users",      userRoutes);
app.use("/api/messages",   messageRoutes);
app.use("/api/payment",    paymentRoutes);
app.use("/api/discover",   discoverRoutes);

// ── Mock users endpoint (for development/testing) ─────────────────────────────
app.get("/api/users", (req, res) => {
  const user = {
    _id: "1",
    name: "Bunny",
    age: 45,
    location: "Rayong, Thailand",
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
  res.json([user]);
});

// ── Multer error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    // e.g. file too large
    return res.status(413).json({ error: err.message });
  }
  next(err);
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found" });
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server Error" });
});

// ── Mongo + launch ────────────────────────────────────────────────────────────
mongoose.set("strictQuery", true);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () =>
      console.log(`✅ Server running on http://localhost:${PORT}`)
    );
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));

module.exports = app;
