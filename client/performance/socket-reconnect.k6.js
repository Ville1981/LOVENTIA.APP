// @ts-nocheck
// File: client/performance/socket-reconnect.k6.js
// k6 script that exercises Socket.IO reconnect behavior via the Engine.IO websocket.
// NOTE: k6 does not implement the Socket.IO client protocol for you; we speak the
// minimal Engine.IO / Socket.IO framing required for a basic connect → emit → disconnect → reconnect loop.

import { check, sleep } from "k6";
import ws from "k6/ws";
import { Trend, Counter } from "k6/metrics";

// --- REPLACE START: envs, defaults, and metrics ---
const SOCKET_URL =
  __ENV.SOCKET_URL ||
  "ws://localhost:5174/socket.io/?EIO=4&transport=websocket";
const NAMESPACE = __ENV.SIO_NAMESPACE || "/"; // default namespace
const ROOM = __ENV.ROOM || "performance-test";
const ITERATIONS_PER_VU = Number(__ENV.ITER || 5);
const THINK = Number(__ENV.THINK || 0.5);

export let options = {
  scenarios: {
    reconnects: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || "1m",
    },
  },
  thresholds: {
    sio_conn_time: ["p(95)<1000"],
    sio_msg_time: ["p(95)<800"],
    sio_errors: ["count==0"],
  },
};

const connTrend = new Trend("sio_conn_time");
const msgTrend = new Trend("sio_msg_time");
const errCount = new Counter("sio_errors");
// --- REPLACE END ---

/**
 * Very small helper to frame Socket.IO packets:
 * Engine.IO control frames:
 *  - '2' → ping, expect '3' pong
 * Socket.IO open on namespace:
 *  - '40' + namespace (if not "/") to open
 * Socket.IO event:
 *  - '42' + (namespace if not "/") + JSON array payload
 */
function openNamespace(sock, ns = "/") {
  const prefix = ns && ns !== "/" ? `40${ns},` : "40";
  sock.send(prefix);
}

function emitEvent(sock, eventName, data, ns = "/") {
  const payloadArr = JSON.stringify([eventName, data]);
  const prefix = ns && ns !== "/" ? `42${ns},` : "42";
  sock.send(prefix + payloadArr);
}

function sendPing(sock) {
  sock.send("2");
}

export default function () {
  for (let i = 0; i < ITERATIONS_PER_VU; i++) {
    const start = Date.now();

    const res = ws.connect(SOCKET_URL, {}, (socket) => {
      let opened = false;
      let gotPong = false;

      // When underlying ws is open, initialize Socket.IO namespace
      socket.on("open", () => {
        opened = true;
        openNamespace(socket, NAMESPACE);
      });

      // Any incoming frame from server
      socket.on("message", (msg) => {
        // Example messages:
        //  - '0{"sid":"...","pingInterval":25000,"pingTimeout":20000}' (Engine.IO open)
        //  - '40' or '40/namespace,' (Socket.IO open)
        //  - '3' (Engine.IO pong)
        //  - '42["event","payload"]' (Socket.IO event)
        try {
          if (typeof msg !== "string") return;

          if (msg[0] === "3") {
            gotPong = true;
            return;
          }

          // If server acknowledges Socket.IO open, optionally join a room
          if (msg.startsWith("40")) {
            // Join a logical room/channel on your server if supported
            emitEvent(socket, "joinRoom", { room: ROOM }, NAMESPACE);
            return;
          }

          // Basic sample of tracking server events timing
          if (msg.startsWith("42")) {
            msgTrend.add(Date.now() - start);
          }
        } catch (e) {
          errCount.add(1);
        }
      });

      socket.on("error", () => {
        errCount.add(1);
      });

      socket.on("close", () => {
        // nothing here; the outer loop will reconnect
      });

      // Simple activity loop within one connection
      // - wait a bit
      // - ping/pong handshake
      // - emit message
      // - wait
      // - close to force reconnect in next iteration
      socket.setTimeout(function activity() {
        if (!opened) {
          // try again shortly until 'open' fires
          socket.setTimeout(activity, 50);
          return;
        }

        // Track connection open latency
        connTrend.add(Date.now() - start);

        // Engine.IO ping → expect '3' pong
        sendPing(socket);

        // Emit an application-level event
        emitEvent(
          socket,
          "sendMessage",
          { room: ROOM, message: `k6-vu:${__VU}-iter:${i}` },
          NAMESPACE
        );

        // Wait for a moment to allow server to respond/broadcast
        socket.setTimeout(() => {
          // If no pong observed, increment error counter (server should reply '3')
          if (!gotPong) errCount.add(1);

          // Cleanly close to simulate drop & next-iteration reconnect
          try {
            socket.close();
          } catch (e) {
            // ignore
          }
        }, THINK * 1000);
      }, 0);
    });

    check(res, {
      "ws connected": (r) => r && r.status === 101,
    });

    sleep(THINK);
  }
}
