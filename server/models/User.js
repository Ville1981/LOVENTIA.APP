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
    religion: String,
    religionImportance: String,
    children: String,
    pets: String,
    summary: String,
    goal: String,
    goals: String,      // old field, kept for backwards compatibility
    lookingFor: String,
    interests: [String],
    status: String,

    // 🌐 Location & Custom fields
    country: String,
    region: String,
    city: String,
    customCountry: String,
    customRegion: String,
    customCity: String,

    // 🗺️ Coordinates
    latitude: Number,
    longitude: Number,

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
    height: Number,
    weight: Number,
    bodyType: {
      type: String,
      enum: ["slim", "normal", "athletic", "overweight", "obese", ""],
      default: "normal",
    },
    activityLevel: {
      type: String,
      enum: ["sedentary", "light", "moderate", "active", "veryActive", ""],
      default: "sedentary",
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
        "glutenFree",
        "gluten-free",
        "dairyFree",
        "dairy-free",
        "nutFree",
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
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
