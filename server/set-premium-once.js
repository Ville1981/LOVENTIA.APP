import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".\\.env" });

// Minimal User model (field subset) to avoid importing app code
const userSchema = new mongoose.Schema({}, { strict: false, collection: "users" });
const User = mongoose.model("User", userSchema);

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: node set-premium-once.js <userId>");
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI in env");
    process.exit(2);
  }
  await mongoose.connect(uri);

  // Build premium payload (non-destructive: only flips premium flags + tier)
  const update = {
    isPremium: true,
    premium: true,
    "entitlements.tier": "premium",
    // Optional: enable some features if your app expects them (kept conservative)
    // "entitlements.features.unlimitedRewinds": true,
    // "entitlements.features.unlimitedLikes": true,
  };

  const before = await User.findById(id).lean();
  console.log("Before:", { _id: before?._id, isPremium: before?.isPremium, tier: before?.entitlements?.tier });

  const res = await User.updateOne({ _id: id }, { $set: update });
  console.log("Update result:", { matched: res.matchedCount ?? res.matched, modified: res.modifiedCount ?? res.modified });

  const after = await User.findById(id).lean();
  console.log("After:", { _id: after?._id, isPremium: after?.isPremium, tier: after?.entitlements?.tier });

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(9); });
