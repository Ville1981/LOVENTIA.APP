(async () => {
  const mongooseMod = await import("mongoose");
  const mongoose = mongooseMod.default || mongooseMod;
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict:false }));
  const meId="68db939dc56b6da38dcbc3ed", t="68dbab960ad9f214f4cdfe93";
  const OID = (v)=>new mongoose.Types.ObjectId(v);
  await User.updateOne({ _id: OID(meId) }, { $push: { passes: OID(t) } });
  await mongoose.disconnect();
})();
