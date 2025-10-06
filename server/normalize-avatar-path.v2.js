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
  // Replace any backslash with forward slash
  let norm = raw ? raw.replace(/\\/g, "/") : "";
  // Ensure it starts with /uploads/
  if (norm && norm.startsWith("uploads/")) norm = "/" + norm;
  if (norm && !norm.startsWith("/uploads/") && norm.includes("uploads/")) {
    norm = "/" + norm.slice(norm.indexOf("uploads/"));
  }

  console.log("Raw:", raw);
  console.log("Norm:", norm);

  if (norm && norm !== raw) {
    const res = await User.updateOne(
      { _id: id },
      { $set: { profilePicture: norm, profilePhoto: norm, avatar: norm } }
    );
    console.log("Update:", { matched: res.matchedCount ?? res.matched, modified: res.modifiedCount ?? res.modified });
  } else {
    console.log("No change needed.");
  }

  const after = await User.findById(id).lean();
  console.log("After.profilePicture:", after?.profilePicture);
  await mongoose.disconnect();
  process.exit(0);
})();
