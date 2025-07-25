require("dotenv").config();

const express       = require("express");
const mongoose      = require("mongoose");
const cors          = require("cors");
const cookieParser  = require("cookie-parser");
const path          = require("path");

// Ensure models are registered before middleware/routes
require("./models/User");
// --- REPLACE START: register Message model so Mongoose knows about it ---
require("./models/Message");
// --- REPLACE END ---

const app = express();

// ── Stripe & PayPal webhooks ───────────────────────────────────────────────────
// These need to see the raw body, so they must come before express.json()
const stripeWebhookRouter = require("./routes/stripeWebhook");
const paypalWebhookRouter = require("./routes/paypalWebhook");
app.use("/api/payment/stripe-webhook", stripeWebhookRouter);
app.use("/api/payment/paypal-webhook", paypalWebhookRouter);

// ── Common middleware ───────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5174",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve uploads folder as static files ────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Mount application routes ────────────────────────────────────────────────────
const authRoutes     = require("./routes/auth");
const userRoutes     = require("./routes/userRoutes");
const imageRoutes    = require("./routes/imageRoutes");
const paymentRoutes  = require("./routes/payment");
const discoverRoutes = require("./routes/discover");
const authenticate   = require("./middleware/authenticate");
const messageRoutes  = require("./routes/messageRoutes");

// Mount Auth routes (no auth middleware)
app.use("/api/auth", authRoutes);

// Mount Messages under authentication
app.use("/api/messages", authenticate, messageRoutes);

// Mount remaining routes under authentication
app.use("/api/users", authenticate, userRoutes);
app.use("/api/images", authenticate, imageRoutes);
app.use("/api/payment", authenticate, paymentRoutes);
app.use("/api/discover", authenticate, discoverRoutes);

// ── Temporary mock users endpoint ───────────────────────────────────────────────
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
    summary: "Positive mindset, self-development …",
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
