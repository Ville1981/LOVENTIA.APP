// server/models/User.js

// --- REPLACE START: convert to ESM import ---
import mongoose from 'mongoose';
// --- REPLACE END ---

// Define User schema with all necessary fields
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isPremium: { type: Boolean, default: false },
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
    location: { country: String, region: String, city: String },
    latitude: Number,
    longitude: Number,
    // Images
    profilePicture: String,
    extraImages: [String],
    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

// --- REPLACE START: export User model as ESM default ---
export default mongoose.model('User', userSchema);
// --- REPLACE END ---
