// --- REPLACE START: Always reset and create test user for auth flow ---
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function seedTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    const email = 'testuser@example.com';
    const plainPassword = 'TestPass123';
    const name = 'Test User';

    // Always remove old test user
    const deleted = await User.deleteOne({ email });
    if (deleted.deletedCount > 0) {
      console.log(`🗑️ Removed existing test user: ${email}`);
    }

    // Create fresh test user
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const user = new User({
      email,
      password: hashedPassword,
      name,
      role: 'user',
    });
    await user.save();

    console.log(`✅ Test user created: ${email} / ${plainPassword}`);
    console.log('🎯 Seeding completed');
  } catch (error) {
    console.error('❌ Error seeding test user:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

seedTestUser();
// --- REPLACE END ---
