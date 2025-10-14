import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

export default function expressLoader() {
  const app = express();
  app.set('trust proxy', 1);

  // NOTE: If you verify Stripe signatures with raw body,
  // mount those routes in webhooks BEFORE json() (see webhooks/stripe.js).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());
  app.use(cors({ origin: env.CLIENT_ORIGIN || true, credentials: true }));

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploads = path.join(__dirname, '..', '..', 'uploads');
  app.use('/uploads', express.static(uploads, { fallthrough: true }));

  return app;
}
