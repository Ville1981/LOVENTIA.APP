const express       = require("express");
const mongoose      = require("mongoose");
const dotenv        = require("dotenv");
const cors          = require("cors");
const cookieParser  = require("cookie-parser");
const path          = require("path");

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

const app = express();

// ——— NEW CORS & PREFLIGHT HANDLER —————————————————————————————————————
// Global CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5174",
    credentials: true,
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization"],
  })
);

// Ensure OPTIONS preflight works for our crop‐upload endpoint
app.options(
  "/api/users/:userId/photos/upload-photo-step",
  cors(),             // re-use the same CORS policy
  (req, res) => res.sendStatus(200)
);
// ———————————————————————————————————————————————————————————————————————

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
const adminRoutes    = require("./routes/admin");

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

// Parse JSON and URL-encoded bodies
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
app.use("/api/auth", authRoutes);

// ←─── PART 1: IMAGE ROUTES ────────────────────────────────────────────────────
app.use("/api/users", imageRoutes);
// ────────────────────────────────────────────────────────────────────────────────

// User routes including PUT /api/users/profile
app.use("/api/users", userRoutes);

app.use("/api/messages", messageRoutes);
app.use("/api/payment",  paymentRoutes);

// Protect admin routes under /api/admin
app.use("/api/admin",    adminRoutes);

// Mount Discover (must come after other /api mounts)
app.use("/api/discover", discoverRoutes);

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

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
