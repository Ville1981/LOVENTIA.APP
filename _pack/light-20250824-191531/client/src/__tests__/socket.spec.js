import EventEmitter from "events";

describe("Socket Service Reliability", () => {
  let mockSocket;
  let io;

  jest.useFakeTimers();

  // Mock socket.io-client
  jest.mock("socket.io-client", () => ({
    io: (url, opts) => {
      mockSocket = new EventEmitter();
      mockSocket.connect = jest.fn(() => mockSocket.emit("connect"));
      mockSocket.disconnect = jest.fn(() => mockSocket.emit("disconnect"));
      mockSocket.on = mockSocket.addListener.bind(mockSocket);
      mockSocket.off = mockSocket.removeListener.bind(mockSocket);
      return mockSocket;
    },
  }));

  // Import after mocking
  const {
    socket,
    connectSocket,
    disconnectSocket,
    onNewMessage,
    offNewMessage,
  } = require("../services/socket");

  afterEach(() => {
    jest.clearAllTimers();
    jest.resetModules();
  });

  test("connectSocket invokes socket.connect()", () => {
    connectSocket();
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  test("disconnectSocket invokes socket.disconnect()", () => {
    disconnectSocket();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  test("onNewMessage deduplicates duplicate messages", () => {
    const handler = jest.fn();
    onNewMessage(handler);

    const msg = { id: "unique-id", text: "hello" };
    mockSocket.emit("newMessage", msg);
    mockSocket.emit("newMessage", msg);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("onNewMessage handles distinct message IDs", () => {
    const handler = jest.fn();
    onNewMessage(handler);

    const msg1 = { id: "id1", text: "first" };
    const msg2 = { id: "id2", text: "second" };
    mockSocket.emit("newMessage", msg1);
    mockSocket.emit("newMessage", msg2);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  test("connect event sets up heartbeat and dedupe cleanup intervals", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    // Re-import to re-trigger module-level listener registration
    jest.resetModules();
    require("../services/socket");

    // Emulate connection
    mockSocket.emit("connect");

    // Expect two intervals: heartbeat (25s) and cleanup (60s)
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 25000);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
  });

  test("disconnect event clears heartbeat and dedupe intervals", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    mockSocket.emit("disconnect");
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
