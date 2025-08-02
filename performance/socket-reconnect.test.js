// @ts-nocheck
// File: client/performance/socket-reconnect.test.js
// Artillery script for socket connection drop and reconnect testing

module.exports = {
  config: {
    target: __ENV.APP_URL || 'http://localhost:3000',
    phases: [
      {
        duration: 60, // total duration in seconds
        arrivalRate: 10, // new virtual users per second
      },
    ],
  },
  scenarios: [
    {
      name: 'Socket reconnect test',
      engine: 'socketio',
      flow: [
        // Join a test room
        {
          emit: {
            channel: 'joinRoom',
            data: { room: 'performance-test' },
          },
        },
        // Loop of connect, message, disconnect, reconnect
        {
          loop: {
            count: 10,
            flow: [
              { think: 1 },
              {
                emit: {
                  channel: 'sendMessage',
                  data: {
                    room: 'performance-test',
                    message: 'Performance test message',
                  },
                },
              },
              { think: 1 },
              {
                emit: {
                  channel: 'disconnect',
                },
              },
              { think: 0.5 },
              {
                emit: {
                  channel: 'reconnect',
                },
              },
              { think: 1 },
              {
                emit: {
                  channel: 'sendMessage',
                  data: {
                    room: 'performance-test',
                    message: 'Reconnected message',
                  },
                },
              },
            ],
          },
        },
      ],
    },
  ],
};
