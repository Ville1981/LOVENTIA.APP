import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: process.env.MONGO_URI || process.env.DATABASE_URL || '',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  ENABLE_MORGAN: (process.env.ENABLE_MORGAN || 'true') === 'true',
};
