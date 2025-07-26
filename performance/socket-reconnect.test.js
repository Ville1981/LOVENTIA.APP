// client/performance/socket-reconnect.test.js
// Artillery‑skripti socket‑yhteyden katkojen ja uudelleenyhteyden testaukseen

module.exports = {
  config: {
    target: 'http://localhost:3000',
    phases: [
      {
        duration: 60,       // ajoaika sekunneissa
        arrivalRate: 10     // uudet käyttäjät sekunnissa
      }
    ]
  },
  scenarios: [
    {
      name: 'Socket reconnect test',
      engine: 'socketio',
      flow: [
        {
          emit: {
            channel: 'join',
            data: { room: 'performance-test' }
          }
        },
        {
          loop: {
            count: 10,
            flow: [
              { think: 1 },
              {
                emit: {
                  channel: 'message',
                  data: { content: 'Performance test message' }
                }
              },
              { think: 1 },
              { emit: { channel: 'disconnect' } },
              { think: 0.5 },
              { emit: { channel: 'reconnect' } },
              { think: 1 },
              {
                emit: {
                  channel: 'message',
                  data: { content: 'Reconnected message' }
                }
              }
            ]
          }
        }
      ]
    }
  ]
};
