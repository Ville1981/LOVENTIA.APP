// --- REPLACE START ---
import { vi, expect, describe, test, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'events';

// Use fake timers for heartbeat / cleanup intervals
vi.useFakeTimers();

// Mock socket.io-client to provide a controllable EventEmitter-based socket
let mockSocket;
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => {
      mockSocket = new EventEmitter();
      // Basic socket-like API
      mockSocket.connect = vi.fn(() => mockSocket.emit('connect'));
      mockSocket.disconnect = vi.fn(() => mockSocket.emit('disconnect'));
      mockSocket.on = mockSocket.addListener.bind(mockSocket);
      mockSocket.off = mockSocket.removeListener.bind(mockSocket);
      // Helper for tests if ever needed
      mockSocket.emitClient = (...args) => mockSocket.emit(...args);
      // Simulate connected flag used by the service (if referenced)
      Object.defineProperty(mockSocket, 'connected', {
        get: () => false,
      });
      return mockSocket;
    }),
  };
});

describe('Socket Service Reliability', () => {
  let originalWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.resetModules();

    // ✅ Provide a minimal window for Node test env (used by services/socket.js)
    originalWindow = global.window;
    global.window = {
      location: { origin: 'http://localhost' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Dynamically import AFTER window mock so the module sees it at import time
    await import('../services/socket.js');
  });

  afterEach(() => {
    // Restore globals
    global.window = originalWindow;
    vi.clearAllTimers();
  });

  test('connect event sets up heartbeat and dedupe intervals', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    // Emulate connection
    mockSocket.emit('connect');

    // Expect two intervals: heartbeat (25s) and cleanup (60s)
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 25000);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
  });

  test('disconnect event clears heartbeat and dedupe intervals', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    // First emulate a connect so the service actually creates the intervals
    mockSocket.emit('connect');

    // Now emulate disconnect; both intervals should be cleared
    mockSocket.emit('disconnect');

    expect(clearIntervalSpy).toHaveBeenCalled();
    // Should clear at least the two intervals that were set on connect
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
// --- REPLACE END ---
