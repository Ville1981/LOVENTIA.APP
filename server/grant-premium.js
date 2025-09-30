(async () => {
  const mongooseMod = await import("mongoose");
  const mongoose = mongooseMod.default || mongooseMod;

  await mongoose.connect(process.env.MONGO_URI, {});

  // Schema-less varmistus
  const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict: false }));

  // Nämä korvataan PowerShellillä seuraavassa stepissä
  const meId = "68db939dc56b6da38dcbc3ed";
  const targetId = "68dba72f0ad9f214f4cdfe89";

  const OID = (v) => (typeof v === "string" ? new mongoose.Types.ObjectId(v) : v);

  // Näytä nykyinen tila
  const before = await User.findById(OID(meId)).lean();
  console.log("Before:", {
    _id: before?._id,
    isPremium: before?.isPremium,
    plan: before?.plan,
    unlimitedRewinds: before?.entitlements?.features?.unlimitedRewinds,
    likesCount: Array.isArray(before?.likes) ? before.likes.length : 0,
    passesCount: Array.isArray(before?.passes) ? before.passes.length : 0,
  });

  // Päivitys
  const res = await User.updateOne(
    { _id: OID(meId) },
    {
      $set: {
        isPremium: true,
        plan: "premium",
        "entitlements.features.unlimitedRewinds": true,
        likes: [OID(targetId)],
        passes: [],
      },
    }
  );

  console.log("Update result:", { matched: res.matchedCount ?? res.n, modified: res.modifiedCount ?? res.nModified });

  // Näytä jälkitila
  const after = await User.findById(OID(meId)).lean();
  console.log("After:", {
    _id: after?._id,
    isPremium: after?.isPremium,
    plan: after?.plan,
    unlimitedRewinds: after?.entitlements?.features?.unlimitedRewinds,
    likesCount: Array.isArray(after?.likes) ? after.likes.length : 0,
    passesCount: Array.isArray(after?.passes) ? after.passes.length : 0,
    likesFirst: Array.isArray(after?.likes) && after.likes.length ? String(after.likes[after.likes.length - 1]) : null,
  });

  await mongoose.disconnect();
  process.exit(0);
})();
