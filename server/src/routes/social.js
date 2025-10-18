// --- REPLACE START: conflict markers resolved (kept incoming side) ---
// server/src/routes/social.js
import express from 'express';


// Instagram-integraatio pois käytöstä → stub palauttaa tyhjän listan
const fetchInstagramPosts = async (_userId, _limit = 5) => [];

// Yritä ladata Spotify-integraatio riippumatta export-tyylistä (named vs default)
let fetchSpotifyPlaylist;
let getSpotifyEmbedUrl;

try {
  const mod = await import('../integrations/spotifyService.js');

  // Nimetyt exportit
  fetchSpotifyPlaylist =
    mod.fetchSpotifyPlaylist ||
    mod.default?.fetchSpotifyPlaylist ||
    mod.getPlaylist ||                   // mahdollinen vaihtoehtoinen nimi
    mod.default?.getPlaylist;

  getSpotifyEmbedUrl =
    mod.getSpotifyEmbedUrl ||
    mod.default?.getSpotifyEmbedUrl;
} catch {
  // moduulia ei löytynyt → stubbataan alla
}

// Fallbackit: jos integraatiota ei ole tai nimet ei täsmää
if (!getSpotifyEmbedUrl) {
  getSpotifyEmbedUrl = (playlistId) =>
    `https://open.spotify.com/embed/playlist/${encodeURIComponent(playlistId)}`;
}

if (!fetchSpotifyPlaylist) {
  // Palauta minimaalinen objekti, jotta frontti ei hajoa
  fetchSpotifyPlaylist = async (playlistId) => ({
    id: playlistId,
    name: null,
    description: null,
    tracks: [],
  });
}

const router = express.Router();

/**
 * GET /social/instagram/:userId
 * Palauttaa tyhjän listan (integraatio poistettu käytöstä).
 */
router.get('/instagram/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const raw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(raw) ? raw : 5;

    const posts = await fetchInstagramPosts(userId, limit);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Failed to load Instagram posts' });
  }
});

/**
 * GET /social/spotify/:playlistId
 * Palauttaa soittolistan tiedot sekä upotus-URL:n.
 */

router.get('/spotify/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const playlist = await fetchSpotifyPlaylist(playlistId);
    const embedUrl = getSpotifyEmbedUrl(playlistId);
    res.json({ ...playlist, embedUrl });
  } catch (err) {

    res.status(500).json({ error: err?.message || 'Failed to load Spotify playlist' });

  }
});

export default router;

// --- REPLACE END ---
