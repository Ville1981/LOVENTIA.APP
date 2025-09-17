// server/src/routes/social.js
import express from 'express';
import { fetchInstagramPosts } from '../integrations/instagramService.js';
import { fetchSpotifyPlaylist, getSpotifyEmbedUrl } from '../integrations/spotifyService.js';

const router = express.Router();

// Hae Instagram-postaukset
router.get('/instagram/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    const posts = await fetchInstagramPosts(userId, limit);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hae Spotify-soittolistan upotus-URL ja tiedot
router.get('/spotify/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const playlist = await fetchSpotifyPlaylist(playlistId);
    const embedUrl = getSpotifyEmbedUrl(playlistId);
    res.json({ ...playlist, embedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
