(async () => {
  const mongooseMod = await import("mongoose");
  const mongoose = mongooseMod.default || mongooseMod;
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict:false }));
  const meId="68db939dc56b6da38dcbc3ed", a="68dbab960ad9f214f4cdfe93", b="68dbab960ad9f214f4cdfe97";
  const OID = (v)=>new mongoose.Types.ObjectId(v);
  const res = await User.updateOne({ _id: OID(meId) }, { $push: { likes: { $each: [OID(a), OID(b)] } } });
  console.log("matched", res.matchedCount ?? res.n, "modified", res.modifiedCount ?? res.nModified);
  await mongoose.disconnect();
})();
