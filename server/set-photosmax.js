import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".\\.env" });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const id = "68dbe8a02a82bbafa778e362";

(async () => {
  await mongoose.connect(uri);
  const User = mongoose.model("User", new mongoose.Schema({}, { strict:false, collection:"users" }));

  const before = await User.findById(id).lean();
  console.log("Before.photosMax:", before?.entitlements?.features?.photosMax);

  const res = await User.updateOne(
    { _id: id },
    { $set: { "entitlements.features.photosMax": 50 } }
  );
  console.log("Update:", { matched: res.matchedCount ?? res.matched, modified: res.modifiedCount ?? res.modified });

  const after = await User.findById(id).lean();
  console.log("After.photosMax:", after?.entitlements?.features?.photosMax);

  await mongoose.disconnect();
  process.exit(0);
})();
