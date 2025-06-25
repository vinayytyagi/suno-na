const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const songRoutes = require('./routes/songs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
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

  socket.on('userLogin', (userData) => {
    connectedUsers.set(socket.id, userData);
    io.emit('userStatusUpdate', {
      userId: userData.role,
      status: 'online',
      socketId: socket.id
    });
    broadcastAllUserStatus();
    // Notify Muskan when Vinay comes online
    if (userData.role === 'V') {
      io.emit('vinayOnline', { message: 'Vinay is now online!' });
    }
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
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suno-na')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 