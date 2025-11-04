// PATH: server/src/loaders/express.js

import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

// --- REPLACE START (single-line import) ---
import corsConfig from "../config/cors.js";
// --- REPLACE END ---


export default function expressLoader() {
  const app = express();
  app.set('trust proxy', 1);

  // --- REPLACE START: capture raw body for /webhooks so Stripe signature verification works ---
  /**
   * Capture the raw Buffer for webhook endpoints before JSON/urlencoded parsing.
   * This preserves the original signed payload required by Stripe's constructEvent().
   * NOTE: We only attach the raw buffer for URLs that start with /webhooks to avoid
   *       unnecessary memory usage elsewhere.
   */
  const captureRawForWebhooks = (req, _res, buf) => {
    try {
      if (
        req &&
        typeof req.originalUrl === 'string' &&
        req.originalUrl.startsWith('/webhooks') &&
        Buffer.isBuffer(buf)
      ) {
        // Consumed later by the Stripe webhook controller:
        //   stripe.webhooks.constructEvent(req.rawBody, sig, secret)
        req.rawBody = buf;
      }
    } catch {
      // Never throw inside verify() to avoid breaking request parsing.
    }
  };
  // --- REPLACE END ---

  // NOTE: Webhook routes are mounted before parsers in app.js,
  // but we still provide verify() to guarantee req.rawBody is available.
  // --- REPLACE START: attach verify() so req.rawBody is available on /webhooks ---
  app.use(
    express.json({
      limit: '1mb',
      verify: captureRawForWebhooks,
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: '1mb',
      verify: captureRawForWebhooks,
    })
  );
  // --- REPLACE END ---

  app.use(compression());

  // --- REPLACE START: centralized CORS (no inline configs here) ---
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
