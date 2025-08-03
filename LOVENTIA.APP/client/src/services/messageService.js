import axios from '../utils/axiosInstance';

/**
 * Service for fetching and sending chat messages.
 * All methods return a Promise resolving to the response data.
 */
const messageService = {
  /**
   * Fetch a list of conversation overviews.
   * Each overview should include: userId, displayName, avatarUrl,
   * lastMessageTimestamp, snippet, unreadCount.
   */
  getOverview: async function() {
    // --- REPLACE START: use correct endpoint ---
    const response = await axios.get('/api/messages/overview');
    // --- REPLACE END ---
    return response.data;
  },

  /**
   * Fetch full message history with a specific user.
   * @param {string} userId - ID of the user to fetch messages for.
   */
  getConversation: async function(userId) {
    // --- REPLACE START: use correct endpoint ---
    const response = await axios.get(`/api/messages/${userId}`);
    // --- REPLACE END ---
    return response.data;
  },

  /**
   * Send a message to a specific user.
   * @param {string} userId - ID of the recipient user.
   * @param {object} payload - Message payload, typically { text: string }.
   */
  sendMessage: async function(userId, payload) {
    // --- REPLACE START: use correct endpoint and payload shape ---
    const response = await axios.post(`/api/messages/${userId}`, payload);
    // --- REPLACE END ---
    return response.data;
  }
};

export default messageService;
