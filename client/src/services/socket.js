// src/services/socket.js
// Socket.io client setup for real-time chat with reliability enhancements
// @ts-nocheck
import { io } from 'socket.io-client';

// Use environment variable or fallback to current origin
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// Retrieve JWT token (ensure you store it under this key when logging in)
// --- REPLACE START: unify storage key to 'accessToken' ---
const token = localStorage.getItem('accessToken');
// --- REPLACE END ---

// Initialize socket with authentication and reconnection options
// --- REPLACE START: configure socket with reconnect and auth payload ---
export const socket = io(SOCKET_URL, {
  auth: { token },
  transports: ['websocket'],       // enforce WebSocket only
  autoConnect: false,             // connect manually via connectSocket()
  reconnection: true,
  reconnectionAttempts: Infinity, // keep trying indefinitely
  reconnectionDelay: 1000,        // initial retry delay: 1s
  reconnectionDelayMax: 5000,     // max retry delay: 5s
  randomizationFactor: 0.5,       // add jitter
});
// --- REPLACE END ---

// --- REPLACE START: heartbeat and deduplication setup ---
let heartbeatInterval;
let dedupeCleanupInterval;
const RECEIPT_CLEAR_INTERVAL = 60000; // clear dedupe set every 60s
const HEARTBEAT_INTERVAL = 25000;     // send heartbeat every 25s

// Store recently received message IDs to avoid duplicates
const receivedMessageIds = new Set();

function startHeartbeat() {
  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat');
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
}

function startDedupeCleanup() {
  dedupeCleanupInterval = setInterval(() => {
    receivedMessageIds.clear();
  }, RECEIPT_CLEAR_INTERVAL);
}

function stopDedupeCleanup() {
  if (dedupeCleanupInterval) clearInterval(dedupeCleanupInterval);
}

// Automatically manage heartbeat and dedupe intervals on connect/disconnect
socket.on('connect', () => {
  startHeartbeat();
  startDedupeCleanup();
});

socket.on('disconnect', () => {
  stopHeartbeat();
  stopDedupeCleanup();
});
// --- REPLACE END ---

/**
 * Connect socket (call before joinRoom).
 */
export function connectSocket() {
  socket.connect();
}

/**
 * Disconnect socket.
 */
export function disconnectSocket() {
  socket.disconnect();
}

/**
 * Join a specific chat room identified by roomId (e.g., `chat_<userId>_<peerId>`).
 */
export function joinRoom(roomId) {
  if (socket.connected) {
    socket.emit('joinRoom', roomId);
  }
}

/**
 * Leave a chat room.
 */
export function leaveRoom(roomId) {
  if (socket.connected) {
    socket.emit('leaveRoom', roomId);
  }
}

/**
 * Send a new message to a room.
 */
export function sendMessage(roomId, message) {
  if (socket.connected) {
    socket.emit('sendMessage', { roomId, message });
  }
}

/**
 * Listen for incoming messages.
 * Deduplicates messages based on message.id.
 * @param {Function} callback - Receives message payload.
 */
export function onNewMessage(callback) {
  socket.on('newMessage', (msg) => {
    // Deduplicate if message ID was seen
    if (msg && msg.id) {
      if (receivedMessageIds.has(msg.id)) return;
      receivedMessageIds.add(msg.id);
    }
    callback(msg);
  });
}

/**
 * Stop listening for incoming messages.
 * @param {Function} callback
 */
export function offNewMessage(callback) {
  socket.off('newMessage', callback);
}

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.
