// client/src/utils/api/social.js
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';

/**
 * Fetch Instagram posts for a given user.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise} axios response with an array of posts
 */
export function fetchInstagramPosts(userId, limit = 5) {
  return axios.get(`${API_BASE}/api/social/instagram/${userId}?limit=${limit}`);
}

/**
 * Fetch Spotify playlist details and embed URL.
 * @param {string} playlistId
 * @returns {Promise} axios response with playlist data
 */
export function fetchSpotifyPlaylist(playlistId) {
  return axios.get(`${API_BASE}/api/social/spotify/${playlistId}`);
}
