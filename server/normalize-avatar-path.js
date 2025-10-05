import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".\\.env" });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const id  = "68dbe8a02a82bbafa778e362";

(async () => {
  await mongoose.connect(uri);
  const User = mongoose.model("User", new mongoose.Schema({}, { strict:false, collection:"users" }));
  const u = await User.findById(id).lean();
  const raw = u?.profilePicture || u?.profilePhoto || u?.avatar || "";
  const fwd = raw ? (raw.replaceAll("\\\\","/").replace(/^\/?uploads\//, "/uploads/")) : "";
  console.log("Raw:", raw);
  console.log("Norm:", fwd);
  if (fwd && fwd !== raw) {
    const res = await User.updateOne({ _id: id }, { $set: { profilePicture: fwd, profilePhoto: fwd, avatar: fwd } });
    console.log("Update:", { matched: res.matchedCount ?? res.matched, modified: res.modifiedCount ?? res.modified });
  } else {
    console.log("No change needed.");
  }
  const after = await User.findById(id).lean();
  console.log("After.profilePicture:", after?.profilePicture);
  await mongoose.disconnect();
  process.exit(0);
})();
