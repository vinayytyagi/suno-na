import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

// Get API URL from environment variable
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [nowPlaying, setNowPlaying] = useState({});
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      const newSocket = io(API_URL);
      setSocket(newSocket);

      // Emit user login
      newSocket.emit('userLogin', { role: user.role });

      // Listen for user status updates
      newSocket.on('userStatusUpdate', (data) => {
        setOnlineUsers(prev => new Map(prev.set(data.userId, data.status)));
      });

      // Listen for all users' status updates
      newSocket.on('allUserStatus', (data) => {
        // data: { M: 'online'/'offline', V: 'online'/'offline' }
        setOnlineUsers(new Map([
          ['M', data.M],
          ['V', data.V]
        ]));
      });

      // Listen for now playing updates
      newSocket.on('nowPlaying', (payload) => {
        setNowPlaying(payload);
      });

      // Listen for stopped playing updates
      newSocket.on('stoppedPlaying', (data) => {
        setNowPlaying(prev => {
          const newState = { ...prev };
          delete newState[data.songId];
          return newState;
        });
      });

      // Listen for Vinay online notification
      newSocket.on('vinayOnline', (data) => {
        // You can implement a toast notification here
        console.log('Vinay is online!', data.message);
      });

      return () => {
        newSocket.close();
      };
    }
  }, [isAuthenticated, user]);

  const emitStartListening = (songId) => {
    if (socket) {
      socket.emit('startListening', songId);
    }
  };

  const emitStopListening = (songId) => {
    if (socket) {
      socket.emit('stopListening', songId);
    }
  };

  const value = {
    socket,
    onlineUsers,
    nowPlaying,
    emitStartListening,
    emitStopListening
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 