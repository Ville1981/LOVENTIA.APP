// server/index.js

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

dotenv.config();

// 🔌 Reitit
const userRoutes = require("./routes/user");              // sis. mm. register, login, profiilin poisto yms.
const userRoutesUpload = require("./routes/userRoutes");  // sis. upload-avatar yms.
const messageRoutes = require("./routes/messageRoutes");
const paymentRoutes = require("./routes/payment");

const app = express();
const PORT = process.env.PORT || 5000;

// 🌐 Middlewaret
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5174", // Frontendin kehitysportti
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📸 Staattinen kuvasisältö (uploads-kansio)
// Tällöin front voi hakea tallennetut kuvat esimerkiksi osoitteesta:
// http://localhost:5000/uploads/<tiedostonimi>.jpg
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -------------------------------------------------------------
// Kovakoodattu mock-data “Discover” -testausta varten
app.get("/api/users", (req, res) => {
  // Yksi testikäyttäjä Bunny
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
    details: {
      gender: "Woman",
      orientation: "Straight",
      relationshipStatus: "Monogamous (Single)",
      bodyType: "Curvy",
      ethnicity: "Asian",
      languages: ["English", "Thai"],
      education: "Undergraduate degree",
      employment: "Employed full-time",
      religion: "Buddhism",
      smoking: "Doesn't smoke cigarettes",
      drinking: "Drinks sometimes",
      marijuana: "Never",
      diet: "Omnivore",
      kids: "Doesn't have, doesn't want",
      pets: "Doesn't have",
      lookingFor: "Men | New friends & Long-term dating",
    },
  };
  // Palautetaan lista, tässä vain yksi testikäyttäjä
  res.json([user]);
});
// -------------------------------------------------------------

// 🛠 API-reitit

// 1) Säilytämme alkuperäisen “user” -tiedoston reitit (/api/user ja /api/auth)
app.use("/api/user", userRoutes);
app.use("/api/auth", userRoutes);

// 2) UUSI: liitämme “userRoutes.js” –tiedoston, jossa on upload-avatar ja muut
//    Näin POST-requests osoitteeseen /api/users/:userId/upload-avatar toimivat
app.use("/api/users", userRoutesUpload);

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
