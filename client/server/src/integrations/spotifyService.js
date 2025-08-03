// server/src/integrations/spotifyService.js
import SpotifyWebApi from 'spotify-web-api-node';

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

// Sessionissa tai cronissa: hae access token ennen kutsuja
// spotifyApi.setAccessToken('<token>');

/**
 * Hakee soittolistan tiedot ja kappaleet
 * @param {string} playlistId
 * @returns {Promise<Object>} Soittolistan objekti
 */
export async function fetchSpotifyPlaylist(playlistId) {
  if (!spotifyApi.getAccessToken()) {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
  }

  const playlist = await spotifyApi.getPlaylist(playlistId);
  return playlist.body;
}

/**
 * Palauttaa upotus-URL:n soittolistalle
 * @param {string} playlistId
 * @returns {string} Embed URL
 */
export function getSpotifyEmbedUrl(playlistId) {
  return `https://open.spotify.com/embed/playlist/${playlistId}`;
}
