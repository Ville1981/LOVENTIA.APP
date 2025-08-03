// server/socket.js
// @ts-nocheck

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');

function initializeSocket(app) {
  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Initialize Socket.io with CORS for client URL
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5174',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  // Authenticate sockets using JWT in handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.user.id);

    // Join and leave chat rooms
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
    });
    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);
    });

    // Handle sending a message
    socket.on('sendMessage', async ({ roomId, message }) => {
      try {
        const msgDoc = await Message.create({
          room: roomId,
          sender: socket.user.id,
          content: message,
        });
        io.to(roomId).emit('newMessage', msgDoc);
      } catch (err) {
        console.error('Error saving message:', err);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.user.id);
    });
  });

  return httpServer;
}

module.exports = { initializeSocket };
