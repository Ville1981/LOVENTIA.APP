/* File: backend/src/services/socket.js */

const socketio = require('socket.io');

function initSocket(server, app) {
  const io = socketio(server, { cors: { origin: '*' } });
  app.set('io', io);

  io.on('connection', (socket) => {
    const { conversationId } = socket.handshake.query;
    if (conversationId) {
      socket.join(conversationId);
    }

    socket.on('join', (room) => {
      socket.join(room);
    });

    socket.on('leave', (room) => {
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      // cleanup if necessary
    });
  });
}

module.exports = initSocket;
