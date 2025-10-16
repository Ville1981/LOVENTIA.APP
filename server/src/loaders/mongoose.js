import mongoose from 'mongoose';
import { env } from '../config/env.js';

export async function connectMongo() {
  if (!env.MONGO_URI) {
    console.warn('[mongo] MONGO_URI not set — skipping connect');
    return;
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI, {
    autoIndex: env.NODE_ENV !== 'production',
  });
  console.log(`[mongo] Connected (${mongoose.connection.name})`);
}
