const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // 🔒 Tunnistautuminen
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String },    // Profiilikuvan polku tallennetaan tähän
    extraImages: [String],                // Lisäkuvat (max 6)

    // 🧍 Perustiedot
    name: String,
    gender: String,
    age: Number,
    orientation: String,
    education: String,
    profession: String,
    location: String,
    city: String,
    country: String,
    region: String,
    height: String,
    weight: String,
    status: String,
    religion: String,
    religionImportance: String,
    children: String,
    pets: String,
    summary: String,
    goal: String,
    lookingFor: String,
    interests: [String],
    hidden: { type: Boolean, default: false },

    // 💬 Interaktiot
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    superLikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    superLikeTimestamps: [Date],

    // 💖 Match-preferenssit
    preferredGender: { type: String, default: "any" },
    preferredMinAge: { type: Number, default: 18 },
    preferredMaxAge: { type: Number, default: 100 },
    preferredInterests: [String],
    preferredCountry: String,
    preferredRegion: String,
    preferredCity: String,
    preferredReligion: String,
    preferredReligionImportance: String,
    preferredEducation: String,
    preferredProfession: String,
    preferredChildren: String,

    // 💎 Premium
    isPremium: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
