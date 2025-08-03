// server/resetExtraImages.js

const mongoose = require("mongoose");
const dotenv   = require("dotenv");
const path     = require("path");
const User     = require("./models/User");

// Ladataan ympäristömuuttujat server-kansion .env-tiedostosta
dotenv.config({ path: path.resolve(__dirname, ".env") });

async function reset() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is not defined in .env");

    // Yhdistetään tietokantaan
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ MongoDB connected");

    // Tyhjennetään extraImages kaikilta käyttäjiltä
    const result = await User.updateMany({}, { extraImages: [] });
    console.log(`✅ Cleared extraImages for ${result.modifiedCount} users`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  }
}

reset();
