// --- REPLACE START: minimal dynamic OG route (HTML with tags) ---
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();
const User = mongoose.models.User || mongoose.model('User');

const CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5174';

router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const doc = await User.findOne({ username }).select('username name profilePicture').lean().exec();
    if (!doc) return res.status(404).send('Not found');

    const title = `${doc.name || doc.username} — Loventia`;
    const desc  = `View ${doc.name || doc.username}'s profile on Loventia.`;
    const url   = `${CLIENT_ORIGIN}/u/${encodeURIComponent(username)}`;
    const img   = doc.profilePicture
      ? `${CLIENT_ORIGIN}${doc.profilePicture.startsWith('/') ? '' : '/'}${doc.profilePicture}`
      : `${CLIENT_ORIGIN}/og/og-default.jpg`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<meta property="og:type" content="profile" />
<meta property="og:site_name" content="Loventia" />
<meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${img}" />
<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
<meta property="twitter:description" content="${desc.replace(/"/g, '&quot;')}" />
<meta property="twitter:image" content="${img}" />
<meta http-equiv="refresh" content="0; url=${url}" />
</head><body>Redirecting…</body></html>`);
  } catch {
    return res.status(500).send('Server error');
  }
});

export default router;
// --- REPLACE END ---
