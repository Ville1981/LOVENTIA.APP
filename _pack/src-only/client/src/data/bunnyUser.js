// File: src/data/bunnyUser.js

/**
 * Bunny test user data fallback for empty conversation state.
 * This mock user is shown when there are no real conversations.
 */
const bunnyUser = {
  userId: "bunny-001",
  peerName: "Bunny",
  peerAvatarUrl: "/assets/bunny1.jpg", // path to a cute bunny avatar
  lastMessage: "Hop in and start the conversation!",
  lastMessageTimestamp: new Date().toISOString(),
  unreadCount: 0,
};

export default bunnyUser;
