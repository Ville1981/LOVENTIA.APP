// server/src/integrations/instagramService.js
import axios from 'axios';

const INSTAGRAM_API_BASE = 'https://graph.instagram.com';
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

/**
 * Hakee julkiset Instagram-postaukset tietylle käyttäjälle.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>} Lista postauksista
 */
export async function fetchInstagramPosts(userId, limit = 5) {
  if (!ACCESS_TOKEN) {
    throw new Error('Missing Instagram access token');
  }

  const fields = 'id,caption,media_url,permalink,timestamp';
  const url = `${INSTAGRAM_API_BASE}/${userId}/media?fields=${fields}&access_token=${ACCESS_TOKEN}&limit=${limit}`;

  const response = await axios.get(url);
  return response.data.data;
}
