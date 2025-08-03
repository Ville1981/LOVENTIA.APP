// src/services/socketHeartbeat.js
// Utility module to manage WebSocket heartbeat (ping/pong) for socket.io

let heartbeatInterval = null;
const HEARTBEAT_INTERVAL = 25000; // send ping every 25s
let missedPongs = 0;
const MAX_MISSED_PONGS = 2; // after 2 missed pongs, consider connection unhealthy

/**
 * Starts sending heartbeat pings on a given socket.
 * Automatically disconnects if too many pongs are missed.
 * @param {Socket} socket - socket.io client instance
 */
export function startHeartbeat(socket) {
  if (!socket) return;

  // Listen for pong responses
  socket.on("pong", () => {
    missedPongs = 0;
  });

  // Send ping at regular intervals
  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit("ping");
      missedPongs += 1;

      if (missedPongs > MAX_MISSED_PONGS) {
        // Connection is considered stale
        socket.disconnect();
        clearInterval(heartbeatInterval);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stops the heartbeat ping/pong cycle.
 * @param {Socket} socket - socket.io client instance
 */
export function stopHeartbeat(socket) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.off("pong");
  }
}
