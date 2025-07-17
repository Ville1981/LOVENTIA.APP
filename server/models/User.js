// models/User.js

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // 🔒 Authentication
    username:       { type: String, required: true },
    email:          { type: String, required: true, unique: true },
    password:       { type: String, required: true },
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
    name:                String,
    gender:              String,
    age:                 Number,
    orientation:         String,
    education:           String,
    profession:          String,
    professionCategory: {
      type: String,
      enum: [
        "", // no category
        // original categories
        "Administration",
        "Finance",
        "Military",
        "Technical",
        "Healthcare",
        "Education",
        "Entrepreneur",
        "Law",
        "Service",
        "Other",
        // front-end values
        "Farmer/Forest worker",
        "Theologian/Priest",
        "Artist",
        "Athlete",
        "DivineServant",
        "Homeparent",
        "FoodIndustry",
        "Retail",
        "Arts",
        "Government",
        "Retired",
        // legacy variations
        "Farmer",
        "Leader",
        "ForestWorker",
        "DivineService",
      ],
      default: "",
    },
    religion: {
      type: String,
      enum: [
        "", // no selection
        "Christianity",
        "Islam",
        "Hinduism",
        "Buddhism",
        "Folk",
        "None",
        "Other",
        "Atheism",
      ],
      default: "",
    },
    religionImportance: {
      type: String,
      enum: [
        "", // no selection
        "Not at all important",
        "Somewhat important",
        "Very important",
        "Essential",
      ],
      default: "",
    },
    children:           String,
    pets:               String,
    summary:            String,
    goal:               String,
    goals:              String, // legacy
    lookingFor:         String,
    interests:          [String],
    status:             String,

    // 🌐 Location & Custom fields
    country:       String,
    region:        String,
    city:          String,
    customCountry: String,
    customRegion:  String,
    customCity:    String,

    // 🗺️ Coordinates
    latitude:  Number,
    longitude: Number,

    // 🚭 Lifestyle
    smoke: {
      type: String,
      enum: ["", "no", "little", "average", "much", "sober"],
      default: "",
    },
    drink: {
      type: String,
      enum: ["", "no", "little", "average", "much", "sober"],
      default: "",
    },
    drugs: {
      type: String,
      enum: ["", "no", "little", "average", "much", "sober"],
      default: "",
    },

    // ⚖️ Metrics & Health
    height: Number,
    heightUnit: {
      type: String,
      enum: ["", "Cm", "FtIn"],
      default: "",
    },
    weight: Number,
<<<<<<< HEAD

    // ← TÄHÄN LISÄTTY: weightUnit with setter to normalize casing
    weightUnit: {
      type: String,
      enum: ["", "kg", "lb", "Kg", "Lb"],
      default: "",
      set(val) {
        if (typeof val !== "string") return "";
        const lower = val.trim().toLowerCase();
        if (lower === "kg") return "kg";
        if (lower === "lb") return "lb";
        return "";
      },
    },

=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    bodyType: {
      type: String,
      enum: ["Slim", "Normal", "Athletic", "Overweight", "Obese", ""],
      default: "",
    },
    activityLevel: {
      type: String,
      enum: [
        // legacy
        "sedentary", "light", "moderate", "active", "veryActive",
        // new
        "never", "occasionally", "weekly", "daily",
        "",
      ],
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
      set: function (incoming) {
        let arr = [];
        if (
          typeof incoming === "string" &&
          incoming.trim().startsWith("[") &&
          incoming.trim().endsWith("]")
        ) {
          try {
            arr = JSON.parse(incoming);
          } catch {
            arr = [incoming];
          }
        } else if (typeof incoming === "string") {
          arr = [incoming];
        } else if (Array.isArray(incoming)) {
          arr = incoming;
        }
        return arr.map((it) =>
          typeof it === "string" ? it.replace(/^"+|"+$/g, "") : it
        );
      },
    },
    healthInfo: { type: String, default: "" },

    // 💬 Interactions
    likes:               [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    superLikes:          [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers:        [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    superLikeTimestamps: [Date],

    // 💖 Match Preferences
    preferredGender:             { type: String, default: "any" },
    preferredMinAge:             { type: Number, default: 18 },
    preferredMaxAge:             { type: Number, default: 100 },
    preferredInterests:          [String],
    preferredCountry:            String,
    preferredRegion:             String,
    preferredCity:               String,
    preferredReligion:           String,
    preferredReligionImportance: String,
    preferredEducation:          String,
    preferredProfession:         String,
    preferredChildren:           String,

    // 💎 Premium
    isPremium: { type: Boolean, default: false },
    hidden:    { type: Boolean, default: false },

    // 🎛️ Role-Based Access
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      required: true,
    },
<<<<<<< HEAD

    // 🛠️ Password reset fields
    passwordResetToken:   { type: String },
    passwordResetExpires: { type: Date }
=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
