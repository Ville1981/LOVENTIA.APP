// File: client/src/services/socket.js
// Socket.io client setup for real-time chat with reliability enhancements
// @ts-nocheck
import { io } from "socket.io-client";

// --- REPLACE START: robust URL + token retrieval + dev-port remap (5173/5174 -> 5000) ---
/**

* Resolve backend URL for Socket.IO.
* Priority:
* 1. VITE_SOCKET_URL (or VITE_BACKEND_URL / VITE_API_BASE_URL)
* 2. current origin, but map common Vite dev ports 5173/5174 to 5000
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
"[http://localhost:5173](http://localhost:5173)";

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
//
// NOTE: For now, we **disable** real-time Socket.IO connections completely.
// We keep the same public API (socket object + helper functions) so that the
// rest of the app and tests continue to work, but no network connections are
// attempted. This removes the noisy `ws://localhost:5000/socket.io` errors
// from the browser console until real-time chat is implemented.
// --- REPLACE START: configure socket as a no-op stub (no real connection) ---
export const socket = {
// Match the shape that the rest of the app expects.
connected: false,
auth: {},
io: null,
opts: {
path: "/socket.io",
transports: ["websocket", "polling"],
autoConnect: false,
reconnection: false,
},

/**

* No-op connect: real-time Socket.IO is temporarily disabled.
  */
  connect() {
  // Intentionally left blank.
  },

/**

* No-op disconnect.
  */
  disconnect() {
  // Intentionally left blank.
  },

/**

* No-op emit.
  */
  emit(/* event, payload */) {
  // Intentionally left blank.
  },

/**

* No-op on (event listener registration).
  */
  on(/* event, handler */) {
  // Intentionally left blank.
  },

/**

* No-op off (event listener removal).
  */
  off(/* event, handler */) {
  // Intentionally left blank.
  },
  };
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

// With the no-op socket stub, these handlers are effectively no-ops too,
// but we keep them so that future real-time implementation is a drop-in.
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
*
* With the current no-op socket stub, this function does not open any
* network connections; it only keeps the API stable for the rest of the app.
  */
  export function connectSocket() {
  // --- REPLACE START: set auth token just-in-time (even though connect is a no-op for now) ---
  socket.auth = { token: getToken() };
  socket.connect();
  // --- REPLACE END ---
  }

/**

* Disconnect socket.
* Currently a no-op because the socket stub does not connect.
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


