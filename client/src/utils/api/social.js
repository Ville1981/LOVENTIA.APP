// File: client/src/utils/api/social.js

// --- REPLACE START: use centralized axios instance and unify endpoints ---
// --- REPLACE START: use centralized axios instance ---
import api from '../../services/api/axiosInstance';
// --- REPLACE END ---

/**
 * Fetch Instagram posts for a username.
 * @param {string} username
 * @param {number} count
 * @returns {Promise<Array>}
 */
export async function getInstagramFeed(username, count = 5) {
  const res = await api.get(`/api/social/instagram/${username}?count=${count}`);
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Fetch Spotify playlist tracks.
 * @param {string} playlistId
 * @param {number} count
 * @returns {Promise<Array>}
 */
export async function getSpotifyPlaylist(playlistId, count = 5) {
  const res = await api.get(`/api/social/spotify/${playlistId}?count=${count}`);
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * An example of posting a social "like" or similar analytics.
 * @param {string} network - 'instagram' | 'spotify' etc.
 * @param {object} payload
 * @returns {Promise<any>}
 */
export async function postSocialMetric(network, payload) {
  const res = await api.post(`/api/social/${network}/metric`, payload || {});
  return res.data;
}
// --- REPLACE END ---
