// server/models/User.js

const mongoose = require("mongoose");

// Define User schema with all necessary fields
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    // Profile details
    name: String,
    age: Number,
    gender: String,
    status: String,
    religion: String,
    children: String,
    pets: String,
    summary: String,
    goal: String,
    lookingFor: String,
    profession: String,
    professionCategory: String,
    bodyType: String,
    height: Number,
    heightUnit: String,
    weight: Number,
    weightUnit: String,
    location: {
      country: String,
      region: String,
      city: String,
    },
    latitude: Number,
    longitude: Number,
    // Images
    profilePicture: String,
    extraImages: [String],
    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Export the Mongoose model directly
module.exports = mongoose.model("User", userSchema);
