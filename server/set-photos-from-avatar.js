import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".\\.env" });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const id  = "68dbe8a02a82bbafa778e362";

(async () => {
  await mongoose.connect(uri);
  const User = mongoose.model("User", new mongoose.Schema({}, { strict:false, collection:"users" }));
  const u = await User.findById(id).lean();
  const pic = (u?.profilePicture || u?.profilePhoto || u?.avatar || "").toString();

  // normalize to /uploads/...
  let url = pic.replace(/\\/g, "/");
  if (url && url.startsWith("uploads/")) url = "/" + url;
  if (url && !url.startsWith("/uploads/") && url.includes("uploads/")) {
    url = "/" + url.slice(url.indexOf("uploads/"));
  }

  console.log("Avatar URL resolved:", url);

  if (!url) {
    console.error("No avatar url found, aborting.");
    process.exit(2);
  }

  // Ensure lists contain the url once
  const uniq = (arr = []) => Array.from(new Set(arr.filter(Boolean)));
  const photos      = uniq([url, ...(Array.isArray(u?.photos) ? u.photos.map(String) : [])]);
  const extraImages = uniq([url, ...(Array.isArray(u?.extraImages) ? u.extraImages.map(String) : [])]);

  const res = await User.updateOne(
    { _id: id },
    { $set: { photos, extraImages } }
  );

  console.log("Update:", { matched: res.matchedCount ?? res.matched, modified: res.modifiedCount ?? res.modified });
  const after = await User.findById(id).lean();
  console.log("After.photos:", after?.photos);
  console.log("After.extraImages:", after?.extraImages);
  await mongoose.disconnect();
  process.exit(0);
})();
