import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import SongList from './SongList';
import UploadSong from './UploadSong';
import Header from './Header';
import axios from 'axios';

// Get API URL from environment variable
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { onlineUsers, nowPlaying } = useSocket();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSongs();
  }, []);

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
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
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
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
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 