const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // 🔒 Authentication
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String },
    extraImages: {
      type: [String],
      default: [],
      set: function (arr) {
        const max = this.isPremium ? 20 : 6;
        const a = Array.isArray(arr) ? arr.slice(0, max) : [];
        while (a.length < max) a.push(null);
        return a;
      },
    },

    // 🧍 Basic Info
    name: String,
    gender: String,
    age: Number,
    orientation: String,
    education: String,
    profession: String,
    location: String,
    city: String,
    country: String,
    height: { type: Number },  // in cm
    weight: { type: Number },  // in kg
    status: String,
    religion: String,
    religionImportance: String,
    children: String,
    pets: String,
    summary: String,
    goal: String,
    goals: String,
    lookingFor: String,
    interests: [String],
    hidden: { type: Boolean, default: false },

    // 🗺️ Coordinates
    latitude: { type: Number },
    longitude: { type: Number },

    // 🚭 Lifestyle
    smoke: {
      type: String,
      enum: ["no", "little", "average", "much", "sober", ""],
      default: "",
    },
    drink: {
      type: String,
      enum: ["no", "little", "average", "much", "sober", ""],
      default: "",
    },
    drugs: {
      type: String,
      enum: ["no", "little", "average", "much", "sober", ""],
      default: "",
    },

    // ⚖️ Metrics & Health
    bodyType: {
      type: String,
      enum: ["slim", "normal", "athletic", "overweight", "obese", ""],
      default: "",
    },
    activityLevel: {
      type: String,
      enum: ["sedentary", "light", "moderate", "active", "very active", ""],
      default: "",
    },
    nutritionPreferences: {
      type: [String],
      enum: [
        "none",
        "omnivore",
        "vegetarian",
        "vegan",
        "pescatarian",
        "flexitarian",
        "gluten-free",
        "dairy-free",
        "nut-free",
        "halal",
        "kosher",
        "paleo",
        "keto",
        "mediterranean",
        "other",
      ],
      default: [],
    },
    healthInfo: { type: String, default: "" },

    // 💬 Interactions
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    superLikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    superLikeTimestamps: [Date],

    // 💖 Match Preferences
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
