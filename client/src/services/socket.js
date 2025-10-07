// File: client/src/services/socket.js
// Socket.io client setup for real-time chat with reliability enhancements
// @ts-nocheck
import { io } from "socket.io-client";

// --- REPLACE START: robust URL + token retrieval + dev-port remap (5173/5174 -> 5000) ---
/**
 * Resolve backend URL for Socket.IO.
 * Priority:
 *  1) VITE_SOCKET_URL (or VITE_BACKEND_URL / VITE_API_BASE_URL)
 *  2) current origin, but map common Vite dev ports 5173/5174 to 5000
 */
function resolveSocketURL() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const env =
        import.meta.env.VITE_SOCKET_URL ||
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        "";
      if (env) return String(env).replace(/\/+$/, "");
    }
  } catch {
    /* ignore */
  }
  const origin =
    (typeof window !== "undefined" && window.location?.origin) ||
    "http://localhost:5173";
  // Map dev ports to backend :5000
  return origin.replace(/:5173|:5174/i, ":5000").replace(/\/+$/, "");
}

const SOCKET_URL = resolveSocketURL();

/**
 * Read the current JWT from storage in a test/SSR-safe way.
 * Never access localStorage at module top-level to avoid ReferenceError.
 */
function getToken() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}
// --- REPLACE END ---

// Initialize socket with authentication and reconnection options
// (auth is updated right before connect to avoid stale tokens)
// --- REPLACE START: configure socket with reconnect and dynamic auth payload + polling fallback ---
export const socket = io(SOCKET_URL, {
  path: "/socket.io",
  auth: {}, // set just-in-time in connectSocket()
  transports: ["websocket", "polling"], // try websocket first, then fallback
  autoConnect: false, // connect manually via connectSocket()
  reconnection: true,
  reconnectionAttempts: Infinity, // keep trying indefinitely
  reconnectionDelay: 1000, // initial retry delay: 1s
  reconnectionDelayMax: 5000, // max retry delay: 5s
  randomizationFactor: 0.5, // add jitter
});
// --- REPLACE END ---

// --- REPLACE START: heartbeat and deduplication setup ---
let heartbeatInterval;
let dedupeCleanupInterval;
const RECEIPT_CLEAR_INTERVAL = 60000; // clear dedupe set every 60s
const HEARTBEAT_INTERVAL = 25000; // send heartbeat every 25s

// Store recently received message IDs to avoid duplicates
const receivedMessageIds = new Set();

function startHeartbeat() {
  // Clear any existing to avoid duplicates after reconnects
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit("heartbeat");
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = undefined;
  }
}

function startDedupeCleanup() {
  // Clear any existing to avoid duplicates after reconnects
  if (dedupeCleanupInterval) clearInterval(dedupeCleanupInterval);
  dedupeCleanupInterval = setInterval(() => {
    receivedMessageIds.clear();
  }, RECEIPT_CLEAR_INTERVAL);
}

function stopDedupeCleanup() {
  if (dedupeCleanupInterval) {
    clearInterval(dedupeCleanupInterval);
    dedupeCleanupInterval = undefined;
  }
}

// Automatically manage heartbeat and dedupe intervals on connect/disconnect
socket.on("connect", () => {
  startHeartbeat();
  startDedupeCleanup();
});

socket.on("disconnect", () => {
  // Clear BOTH intervals on disconnect to satisfy the test expectation
  stopHeartbeat();
  stopDedupeCleanup();
});
// --- REPLACE END ---

/**
 * Connect socket (call before joinRoom).
 * Sets fresh auth right before connecting to avoid stale tokens and to
 * prevent touching localStorage at import time (helps Vitest/JSDOM).
 */
export function connectSocket() {
  // --- REPLACE START: set auth token just-in-time ---
  socket.auth = { token: getToken() };
  // --- REPLACE END ---
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
    socket.emit("joinRoom", roomId);
  }
}

/**
 * Leave a chat room.
 */
export function leaveRoom(roomId) {
  if (socket.connected) {
    socket.emit("leaveRoom", roomId);
  }
}

/**
 * Send a new message to a room.
 */
export function sendMessage(roomId, message) {
  if (socket.connected) {
    socket.emit("sendMessage", { roomId, message });
  }
}

/**
 * Listen for incoming messages.
 * Deduplicates messages based on message.id.
 * @param {Function} callback - Receives message payload.
 */
export function onNewMessage(callback) {
  socket.on("newMessage", (msg) => {
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
  socket.off("newMessage", callback);
}

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.
