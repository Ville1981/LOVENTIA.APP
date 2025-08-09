// --- REPLACE START: convert ESM import/exports to CommonJS ---
const SpotifyWebApi = require('spotify-web-api-node');
// --- REPLACE END ---

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

// Session or cron: obtain access token before calls
// spotifyApi.setAccessToken('<token>');

/**
 * Fetches playlist details and tracks.
 * @param {string} playlistId
 * @returns {Promise<Object>} Playlist object
 */
async function fetchSpotifyPlaylist(playlistId) {
  if (!spotifyApi.getAccessToken()) {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
  }

  const playlist = await spotifyApi.getPlaylist(playlistId);
  return playlist.body;
}

/**
 * Returns the embed URL for a playlist.
 * @param {string} playlistId
 * @returns {string} Embed URL
 */
function getSpotifyEmbedUrl(playlistId) {
  return `https://open.spotify.com/embed/playlist/${playlistId}`;
}

// --- REPLACE START: export functions in CommonJS ---
module.exports = { fetchSpotifyPlaylist, getSpotifyEmbedUrl };
// --- REPLACE END ---
