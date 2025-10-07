import { MongoClient, ObjectId } from "mongodb";

const client = new MongoClient("mongodb://127.0.0.1:27017");
try {
  await client.connect();
  const db = client.db("loventia");
  const id = new ObjectId("68dab8a761a412065159ff4d");

  const res = await db.collection("users").updateOne(
    { _id: id },
    {
      $set: {
        premium: false,
        isPremium: false,
        "entitlements.tier": "free",
        "entitlements.features.seeLikedYou": false,
        "entitlements.features.unlimitedLikes": false,
        "entitlements.features.unlimitedRewinds": false,
        "entitlements.features.dealbreakers": false,
        "entitlements.features.introsMessaging": false,
        "entitlements.features.noAds": false
      },
      $unset: { subscriptionId: "" }
    }
  );

  console.log("Matched:", res.matchedCount, "Modified:", res.modifiedCount);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await client.close();
}
