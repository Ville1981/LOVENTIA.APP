// PATH: server/src/loaders/express.js

import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

// --- REPLACE START: use centralized CORS config (single source of truth) ---
import corsConfig from '../config/corsConfig.js';
// --- REPLACE END ---

export default function expressLoader() {
  const app = express();
  app.set('trust proxy', 1);

  // NOTE: If you verify Stripe signatures with raw body,
  // mount those routes in webhooks BEFORE json() (see webhooks/stripe.js).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // --- REPLACE START: remove inline cors({ origin: env.CLIENT_ORIGIN ... }) and mount centralized CORS ---
  // All CORS behavior is enforced in server/src/config/corsConfig.js (credentials, allowed headers, preflight, etc.)
  app.use(corsConfig);
  // --- REPLACE END ---

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploads = path.join(__dirname, '..', '..', 'uploads');

  // Static uploads (keep fallthrough true to avoid 404 spam on non-existing files)
  app.use('/uploads', express.static(uploads, { fallthrough: true }));

  return app;
}
