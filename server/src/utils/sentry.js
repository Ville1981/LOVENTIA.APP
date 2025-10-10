// --- REPLACE START: Sentry bootstrap (safe if DSN missing) ---
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

dotenv.config();

export function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return null;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());

  // place errorHandler near the end of the pipeline (after routes)
  return Sentry;
}
// --- REPLACE END ---
