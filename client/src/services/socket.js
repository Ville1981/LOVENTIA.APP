// src/services/socket.js
// Socket.io client setup for real-time chat
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
  autoConnect: false,              // connect manually via connectSocket()
  reconnection: true,
  reconnectionAttempts: Infinity,  // keep trying indefinitely
  reconnectionDelay: 1000,         // initial retry delay: 1s
  reconnectionDelayMax: 5000,      // max retry delay: 5s
  randomizationFactor: 0.5,        // add jitter
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
 * @param {Function} callback - Receives message payload.
 */
export function onNewMessage(callback) {
  socket.on('newMessage', callback);
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
