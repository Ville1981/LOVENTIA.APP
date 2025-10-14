// File: server/src/routes/og.js

// --- REPLACE START: resilient dynamic OG route with lazy User model resolution ---
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Prefer explicit client URL from env; fall back to local dev
const CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5174';

/**
 * Lazily resolve the User model without throwing MissingSchemaError.
 * Order:
 *  1) If already registered in mongoose.models, use it.
 *  2) Try ESM import from typical relative paths.
 *  3) If still missing, return null (route will respond 503).
 * NOTE: We never call mongoose.model('User') without a schema.
 */
let CachedUserModel = null;
async function getUserModel() {
  if (CachedUserModel?.modelName === 'User') return CachedUserModel;

  if (mongoose.models?.User) {
    CachedUserModel = mongoose.models.User;
    return CachedUserModel;
  }

  // Try common locations relative to this file (routes/og.js → ../models/User.js)
  const candidatePaths = [
    '../models/User.js',
    '../../models/User.js',
  ];

  for (const p of candidatePaths) {
    try {
      const mod = await import(p);
      const maybeModel = mod?.default || mod?.User || mod;

      // If importing the module registered the model globally, prefer that one.
      if (mongoose.models?.User) {
        CachedUserModel = mongoose.models.User;
        return CachedUserModel;
      }
      // Or if the module directly exported a ready model
      if (maybeModel?.modelName === 'User') {
        CachedUserModel = maybeModel;
        return CachedUserModel;
      }
    } catch {
      // Continue to next candidate path silently
    }
  }

  // Last check
  if (mongoose.models?.User) {
    CachedUserModel = mongoose.models.User;
    return CachedUserModel;
  }
  return null;
}

/**
 * GET /og/profile/:username
 * Responds with a minimal HTML page that includes Open Graph / Twitter meta tags
 * and immediately redirects to the client profile page via meta refresh.
 * Safe even when the User model isn’t ready (returns 503 instead of crashing).
 */
router.get('/profile/:username', async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) {
      return res.status(503).send('Service Unavailable: User model not ready');
    }

    const { username } = req.params;
    const doc = await User.findOne({ username })
      .select('username name profilePicture')
      .lean()
      .exec();

    if (!doc) return res.status(404).send('Not found');

    const display = doc.name || doc.username || 'Profile';
    const title = `${display} — Loventia`;
    const desc = `View ${display}'s profile on Loventia.`;
    const url = `${CLIENT_ORIGIN}/u/${encodeURIComponent(doc.username)}`;

    // Build absolute image URL (accepts absolute http(s) or server-relative path)
    let img = `${CLIENT_ORIGIN}/og/og-default.jpg`;
    if (doc.profilePicture && typeof doc.profilePicture === 'string') {
      if (/^https?:\/\//i.test(doc.profilePicture)) {
        img = doc.profilePicture;
      } else {
        const needsSlash = doc.profilePicture.startsWith('/') ? '' : '/';
        img = `${CLIENT_ORIGIN}${needsSlash}${doc.profilePicture}`;
      }
    }

    const safe = (s) => String(s ?? '').replace(/"/g, '&quot;');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safe(title)}</title>

<meta property="og:type" content="profile" />
<meta property="og:site_name" content="Loventia" />
<meta property="og:title" content="${safe(title)}" />
<meta property="og:description" content="${safe(desc)}" />
<meta property="og:url" content="${safe(url)}" />
<meta property="og:image" content="${safe(img)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safe(title)}" />
<meta name="twitter:description" content="${safe(desc)}" />
<meta name="twitter:image" content="${safe(img)}" />

<meta http-equiv="refresh" content="0; url=${safe(url)}" />
</head>
<body>Redirecting…</body>
</html>`);
  } catch {
    return res.status(500).send('Server error');
  }
});

export default router;
// --- REPLACE END ---
