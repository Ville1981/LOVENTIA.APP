// src/services/socket.js
// Socket.io client setup for real-time chat

import { io } from 'socket.io-client';

// Use environment variable or fallback to current origin
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// Retrieve JWT token (ensure you store it under this key when logging in)
const token = localStorage.getItem('token');

// --- REPLACE START: configure socket with reconnect and auth payload
export const socket = io(SOCKET_URL, {
  auth: { token },
  transports: ['websocket'],       // enforce WebSocket only
  autoConnect: false,              // we will connect manually
  reconnection: true,
  reconnectionAttempts: Infinity,  // keep trying forever
  reconnectionDelay: 1000,         // start with 1s delay
});
// --- REPLACE END

/**
 * Connect socket (call before joinRoom)
 */
export function connectSocket() {
  socket.connect();
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
  socket.disconnect();
}

/**
 * Join a specific chat room identified by roomId (e.g., `chat_<userId>_<peerId>`)
 */
export function joinRoom(roomId) {
  if (socket.connected) {
    socket.emit('joinRoom', roomId);
  }
}

/**
 * Leave a chat room
 */
export function leaveRoom(roomId) {
  if (socket.connected) {
    socket.emit('leaveRoom', roomId);
  }
}

/**
 * Send a new message to a room
 */
export function sendMessage(roomId, message) {
  if (socket.connected) {
    socket.emit('sendMessage', { roomId, message });
  }
}

/**
 * Listen for incoming messages
 */
export function onNewMessage(callback) {
  socket.on('newMessage', callback);
}

/**
 * Stop listening for incoming messages
 */
export function offNewMessage(callback) {
  socket.off('newMessage', callback);
}
