const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const songRoutes = require('./routes/songs');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is running!', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validation error', details: error.message });
  }
  
  res.status(500).json({ message: 'Internal server error' });
});

// Socket.IO connection handling
const connectedUsers = new Map();
const nowPlayingMap = {};

function broadcastAllUserStatus() {
  // Find if Muskan and Vinay are online
  let isMuskanOnline = false;
  let isVinayOnline = false;
  for (const user of connectedUsers.values()) {
    if (user.role === 'M') isMuskanOnline = true;
    if (user.role === 'V') isVinayOnline = true;
  }
  io.emit('allUserStatus', {
    M: isMuskanOnline ? 'online' : 'offline',
    V: isVinayOnline ? 'online' : 'offline'
  });
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Only set user as online when they are on the dashboard (not just login)
  socket.on('userActive', (userData) => {
    connectedUsers.set(socket.id, userData);
    io.emit('userStatusUpdate', {
      userId: userData.role,
      status: 'online',
      socketId: socket.id
    });
    broadcastAllUserStatus();
    // Notify only the other user when someone comes online
    for (const [otherSocketId, otherUser] of connectedUsers.entries()) {
      if (userData.role === 'V' && otherUser.role === 'M') {
        io.to(otherSocketId).emit('vinayOnline', { message: 'Vinay is now online!' });
      }
      if (userData.role === 'M' && otherUser.role === 'V') {
        io.to(otherSocketId).emit('muskanOnline', { message: 'Muskan is now online!' });
      }
    }
  });

  // Optionally, handle userInactive if you want to mark as offline when leaving dashboard
  socket.on('userInactive', (userData) => {
    connectedUsers.delete(socket.id);
    io.emit('userStatusUpdate', {
      userId: userData.role,
      status: 'offline',
      socketId: socket.id
    });
    broadcastAllUserStatus();
  });

  // Keep userLogin for legacy/compatibility but don't set online here
  socket.on('userLogin', (userData) => {
    // Do nothing or just track login event if needed
  });

  socket.on('startListening', (songId) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      if (!nowPlayingMap[songId]) nowPlayingMap[songId] = new Set();
      nowPlayingMap[songId].add(user.role);
      // Broadcast all listeners for all songs
      const payload = {};
      for (const [id, set] of Object.entries(nowPlayingMap)) {
        payload[id] = Array.from(set);
      }
      io.emit('nowPlaying', payload);
    }
  });

  socket.on('stopListening', (songId) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      if (nowPlayingMap[songId]) {
        nowPlayingMap[songId].delete(user.role);
        if (nowPlayingMap[songId].size === 0) delete nowPlayingMap[songId];
      }
      // Broadcast all listeners for all songs
      const payload = {};
      for (const [id, set] of Object.entries(nowPlayingMap)) {
        payload[id] = Array.from(set);
      }
      io.emit('nowPlaying', payload);
    }
  });

  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id);
      io.emit('userStatusUpdate', {
        userId: user.role,
        status: 'offline'
      });
      broadcastAllUserStatus();
      // Remove user from all nowPlaying sets
      for (const set of Object.values(nowPlayingMap)) {
        set.delete(user.role);
      }
      // Clean up empty sets
      for (const [id, set] of Object.entries(nowPlayingMap)) {
        if (set.size === 0) delete nowPlayingMap[id];
      }
      // Broadcast updated nowPlaying
      const payload = {};
      for (const [id, set] of Object.entries(nowPlayingMap)) {
        payload[id] = Array.from(set);
      }
      io.emit('nowPlaying', payload);
    }
    console.log('User disconnected:', socket.id);
  });

  // Relay RT lcn request from Vinay to Muskan
  socket.on('requestMuskanLocationUpdate', () => {
    for (const [otherSocketId, otherUser] of connectedUsers.entries()) {
      if (otherUser.role === 'M') {
        io.to(otherSocketId).emit('requestMuskanLocationUpdate');
      }
    }
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suno-na')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 