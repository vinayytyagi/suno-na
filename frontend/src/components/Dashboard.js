import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import SongList from './SongList';
import UploadSong from './UploadSong';
import Header from './Header';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { MdOndemandVideo } from 'react-icons/md';

// Get API URL from environment variable
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { onlineUsers, nowPlaying, socket } = useSocket();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSongs();
    if (socket && user) {
      socket.emit('userActive', { role: user.role });
    }
    // Muskan: update location on dashboard mount/refresh
    const updateLocation = () => {
      if (user?.role === 'M' && navigator.geolocation) {
        console.log('Muskan: updating location...');
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: position.timestamp
            };
            try {
              const token = localStorage.getItem('token');
              console.log('Muskan: sending location to backend', loc);
              await axios.post(`${API_URL}/api/auth/users/location`, loc, {
                headers: { Authorization: `Bearer ${token}` }
              });
            } catch (err) {
              console.log('Muskan: error sending location', err);
            }
          },
          (error) => {
            console.log('Muskan: geolocation error', error);
          }
        );
      }
    };
    updateLocation();
    // Listen for RT lcn request from Vinay
    if (socket && user?.role === 'M') {
      socket.on('requestMuskanLocationUpdate', updateLocation);
    }
    return () => {
      if (socket && user) {
        socket.emit('userInactive', { role: user.role });
      }
      if (socket && user?.role === 'M') {
        socket.off('requestMuskanLocationUpdate', updateLocation);
      }
    };
  }, [socket, user]);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/songs`);
      setSongs(response.data);
    } catch (error) {
      console.error('Failed to fetch songs:', error);
      setError('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const handleSongUpload = async (songData) => {
    try {
      const formData = new FormData();
      formData.append('song', songData.file);
      formData.append('title', songData.title);

      const response = await axios.post(`${API_URL}/api/songs/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Refresh songs list
      await fetchSongs();
      return { success: true };
    } catch (error) {
      console.error('Upload failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Upload failed' 
      };
    }
  };

  const handleSongDelete = async (songId) => {
    try {
      await axios.delete(`${API_URL}/api/songs/${songId}`);
      await fetchSongs();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-romantic-50">
      {/* Header */}
      <Header 
        user={user} 
        onlineUsers={onlineUsers} 
        onLogout={handleLogout} 
      />

      {/* Main Content */}
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 mt-16 sm:mt-20">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-6 sm:mb-8 px-2 sm:px-0">
            <h1 className="text-2xl sm:text-4xl font-romantic font-bold text-gray-900 mb-2">
              Welcome back, {user.role === 'M' ? 'Muskan' : 'Vinay'}! 💕
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              {user.role === 'M' 
                ? 'Share your beautiful music with Vinay' 
                : 'Listen to Muskan\'s beautiful music'
              }
            </p>
          </div>

          {/* Upload Section (Muskan only) */}
          {user.role === 'M' && (
            <div className="mb-6 sm:mb-8">
              <UploadSong onUpload={handleSongUpload} />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Songs Section */}
          <div className="card p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900">
                Our Music Collection
              </h2>
              <div className="text-xs sm:text-sm text-gray-500">
                {songs.length} song{songs.length !== 1 ? 's' : ''}
              </div>
            </div>

            <SongList 
              songs={songs} 
              userRole={user.role}
              nowPlaying={nowPlaying}
              onDelete={handleSongDelete}
              onRefresh={fetchSongs}
            />
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={() => navigate('/watch-together')}
              className="bg-gradient-to-br from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-full shadow-lg text-xl transition-all duration-150 flex items-center gap-2"
            >
              <MdOndemandVideo size={24} /> Watch Together
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 