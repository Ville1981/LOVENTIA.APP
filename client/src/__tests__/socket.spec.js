// File: client/src/__tests__/socket.spec.js
// --- REPLACE START ---
import { vi, expect, describe, test, beforeEach, afterEach } from "vitest";

// Use fake timers for heartbeat / cleanup intervals
vi.useFakeTimers();

describe("Socket Service Reliability", () => {
  let originalWindow;
  let socket;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.resetModules();

    // ✅ Provide a minimal window for Node test env (used by services/socket.js)
    originalWindow = global.window;
    global.window = {
      location: { origin: "http://localhost" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    };

    // Dynamically import AFTER window mock so the module sees it at import time
    const mod = await import("../services/socket.js");
    socket = mod.socket;
  });

  afterEach(() => {
    // Restore globals
    global.window = originalWindow;
    vi.clearAllTimers();
  });

  test("connect event sets up heartbeat and dedupe intervals", () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    // Emulate connection (local in-memory socket)
    socket.emit("connect");

    // Expect two intervals: heartbeat (25s) and cleanup (60s)
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 25000);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
  });

  test("disconnect event clears heartbeat and dedupe intervals", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    // First emulate a connect so the service actually creates the intervals
    socket.emit("connect");

    // Now emulate disconnect; both intervals should be cleared
    socket.emit("disconnect");

    expect(clearIntervalSpy).toHaveBeenCalled();
    // Should clear at least the two intervals that were set on connect
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
// --- REPLACE END ---

