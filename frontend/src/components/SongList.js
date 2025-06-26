import React, { useRef, useState, useEffect, createContext, useContext, useCallback } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  TrashIcon,
  HeartIcon,
  MusicalNoteIcon,
  ShareIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import EmojiPicker from 'emoji-picker-react';
import LoveDoveeLoader from './LoveDoveeLoader';
import ModalPortal from './ModalPortal';
import { useNotification } from '../contexts/NotificationContext';

// Get API URL from environment variable
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SongList = ({ songs, userRole, nowPlaying, onDelete, onRefresh }) => {
  const [playingSong, setPlayingSong] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadingSongId, setLoadingSongId] = useState(null);
  const [speedDropdownSongId, setSpeedDropdownSongId] = useState(null);
  const [sharePopoverId, setSharePopoverId] = useState(null);
  const [listenedSeconds, setListenedSeconds] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragTime, setDragTime] = useState(null);
  const audioRefs = useRef({});
  const { emitStartListening, emitStopListening } = useSocket();
  const [search, setSearch] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [playsFilter, setPlaysFilter] = useState('');
  const [playTimeFilter, setPlayTimeFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const { user } = useAuth();
  // Comments state per song
  const [commentsBySong, setCommentsBySong] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const commentsEndRefs = useRef({});
  const [recording, setRecording] = useState({});
  const [mediaRecorders, setMediaRecorders] = useState({});
  const [audioBlobs, setAudioBlobs] = useState({});
  const [audioURLs, setAudioURLs] = useState({});
  const [recordingTime, setRecordingTime] = useState({});
  const recordingTimers = useRef({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSongId, setDeleteSongId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const { notify } = useNotification();
  const [lastPlayedSongId, setLastPlayedSongId] = useState(null);
  const [lastPlayedTime, setLastPlayedTime] = useState(0);
  // For emoji picker outside click
  const emojiPickerRefs = useRef({});
  // Play history modal state
  const [showPlayHistoryModal, setShowPlayHistoryModal] = useState(false);
  const [playHistory, setPlayHistory] = useState([]);
  const [playHistoryLoading, setPlayHistoryLoading] = useState(false);
  const [playHistorySong, setPlayHistorySong] = useState(null);

  // Define the speed cycle order
  const speedCycle = [1, 1.25, 1.5, 2, 0.5, 0.75];

  const getNextSpeed = (current) => {
    const idx = speedCycle.indexOf(current);
    if (idx === -1 || idx === speedCycle.length - 1) return speedCycle[0];
    return speedCycle[idx + 1];
  };

  // Add timeupdate listener to track progress
  useEffect(() => {
    const audio = audioRefs.current[playingSong?.id];
    if (audio) {
      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        setListenedSeconds(Math.floor(audio.currentTime));
      };
      audio.addEventListener('timeupdate', handleTimeUpdate);
      return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [playingSong]);

  // Handle play from main play button
  const handlePlay = async (song) => {
    if (playingSong?.id === song.id || loadingSongId === song.id) return;
    setLoadingSongId(song.id);
    setListenedSeconds(0);
    try {
      // Stop currently playing song
      if (playingSong && playingSong.id !== song.id) {
        const currentAudio = audioRefs.current[playingSong.id];
        if (currentAudio) {
          currentAudio.pause();
        }
        emitStopListening(playingSong.id);
      }

      let audio = audioRefs.current[song.id];
      if (!audio) {
        audio = new window.Audio(song.cloudinaryUrl);
        audioRefs.current[song.id] = audio;
        audio.addEventListener('ended', () => handleAudioEnded(song));
        audio.addEventListener('error', (e) => console.error('Audio error:', e));
        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime);
        });
      } else {
        // If resuming the same song after pause, resume from lastPlayedTime
        if (lastPlayedSongId === song.id && lastPlayedTime > 0) {
          audio.currentTime = lastPlayedTime;
        } else {
          audio.currentTime = 0; // Start from beginning if switching songs
        }
      }

      setPlayingSong(song);
      setLastPlayedSongId(song.id);
      setLastPlayedTime(0);
      emitStartListening(song.id);

      try {
        await audio.play();
        await axios.post(`${API_URL}/api/songs/${song.id}/play`);
        await axios.post(`${API_URL}/api/songs/${song.id}/listening`, {
          isListening: true,
          secondsListened: listenedSeconds
        });
      } catch (playError) {
        setPlayingSong(null);
        emitStopListening(song.id);
        await axios.post(`${API_URL}/api/songs/${song.id}/listening`, {
          isListening: false,
          secondsListened: listenedSeconds
        });
      }
    } catch (error) {
      console.error('Error playing song:', error.message);
      console.error('Full error:', error);
    } finally {
      setLoadingSongId(null);
    }
  };

  // Handle download
  const handleDownload = (song) => {
    const link = document.createElement('a');
    link.href = song.cloudinaryUrl + (song.cloudinaryUrl.includes('?') ? '&' : '?') + 'dl=1';
    link.download = `${song.title}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Song downloaded!');
  };

  // Handle speed change
  const handleSpeedChange = (song, speed) => {
    const audio = audioRefs.current[song.id];
    if (audio) {
      audio.playbackRate = speed;
    }
  };

  // Handle pause from main play button
  const handlePause = async (song) => {
    try {
      const audio = audioRefs.current[song.id];
      if (audio) {
        audio.pause();
      }
      setPlayingSong(null);
      setLastPlayedSongId(song.id);
      setLastPlayedTime(audioRefs.current[song.id]?.currentTime || 0);
      emitStopListening(song.id);
      await axios.post(`${API_URL}/api/songs/${song.id}/listening`, {
        isListening: false,
        secondsListened: listenedSeconds
      });
    } catch (error) {
      console.error('Error pausing song:', error);
    }
  };

  // Handle audio end from main play button
  const handleAudioEnded = async (song) => {
    try {
      setPlayingSong(null);
      emitStopListening(song.id);
      await axios.post(`${API_URL}/api/songs/${song.id}/listening`, {
        isListening: false,
        secondsListened: listenedSeconds
      });
      if (audioRefs.current[song.id]) {
        audioRefs.current[song.id].currentTime = 0;
        audioRefs.current[song.id].src = '';
        delete audioRefs.current[song.id];
      }
      onRefresh();
    } catch (error) {
      console.error('Error handling audio end:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper to get listeners for a song
  const getListeners = (song) => {
    return nowPlaying[song.id] || [];
  };

  // Helper to convert duration string (e.g. 3:45) to seconds
  const durationToSeconds = (duration) => {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return Number(duration) || 0;
  };

  // Helper to format seconds as Xm Ys
  const formatPlayTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m${s > 0 ? ' ' + s + 's' : ''}` : `${s}s`;
  };

  // Helper to calculate play count from total play time and duration
  const calcPlayCount = (totalPlayTime, durationSec) => {
    if (!durationSec) return 0;
    return Math.round(totalPlayTime / durationSec);
  };

  // Filtered songs
  const filteredSongs = songs.filter(song => {
    // Search by title
    if (search && !song.title.toLowerCase().includes(search.toLowerCase())) return false;
    // Filter by duration
    if (durationFilter) {
      const songSec = durationToSeconds(song.duration);
      if (durationFilter === '<2' && songSec >= 120) return false;
      if (durationFilter === '2-4' && (songSec < 120 || songSec > 240)) return false;
      if (durationFilter === '>4' && songSec <= 240) return false;
    }
    // Filter by number of plays
    if (playsFilter) {
      if (playsFilter === '<10' && song.totalPlays >= 10) return false;
      if (playsFilter === '10-50' && (song.totalPlays < 10 || song.totalPlays > 50)) return false;
      if (playsFilter === '>50' && song.totalPlays <= 50) return false;
    }
    // Filter by total play time (totalPlays * duration)
    if (playTimeFilter) {
      const totalPlayTime = song.totalPlays * durationToSeconds(song.duration);
      if (playTimeFilter === '<10m' && totalPlayTime >= 600) return false;
      if (playTimeFilter === '10-30m' && (totalPlayTime < 600 || totalPlayTime > 1800)) return false;
      if (playTimeFilter === '>30m' && totalPlayTime <= 1800) return false;
    }
    return true;
  });

  // Sort filtered songs
  const sortedSongs = [...filteredSongs].sort((a, b) => {
    if (sortBy === 'alpha') {
      return a.title.localeCompare(b.title);
    } else if (sortBy === 'plays') {
      return b.totalPlays - a.totalPlays;
    } else { // 'recent' (default)
      return new Date(b.uploadTime) - new Date(a.uploadTime);
    }
  });

  // Map song IDs to their original upload order (oldest = #1)
  const uploadOrderMap = React.useMemo(() => {
    // Sort all songs by uploadTime ascending (oldest first)
    const sorted = [...songs].sort((a, b) => new Date(a.uploadTime) - new Date(b.uploadTime));
    const map = {};
    sorted.forEach((song, idx) => {
      map[song.id] = idx + 1;
    });
    return map;
  }, [songs]);

  // Fetch comments for a song
  const fetchComments = async (songId) => {
    try {
      const res = await axios.get(`${API_URL}/api/songs/${songId}/comments`);
      setCommentsBySong((prev) => ({ ...prev, [songId]: res.data }));
    } catch {}
  };

  // Post a comment
  const postComment = async (songId) => {
    const text = (commentInputs[songId] || '').trim();
    if (!text) return;
    setCommentLoading((prev) => ({ ...prev, [songId]: true }));
    try {
      const res = await axios.post(`${API_URL}/api/songs/${songId}/comments`, { text });
      setCommentsBySong((prev) => ({ ...prev, [songId]: [...(prev[songId] || []), res.data] }));
      setCommentInputs((prev) => ({ ...prev, [songId]: '' }));
    } catch {}
    setCommentLoading((prev) => ({ ...prev, [songId]: false }));
  };

  // Delete a comment
  const deleteComment = async (songId, commentId) => {
    setCommentLoading((prev) => ({ ...prev, [songId]: true }));
    try {
      await axios.delete(`${API_URL}/api/songs/${songId}/comments/${commentId}`);
      setCommentsBySong((prev) => ({
        ...prev,
        [songId]: (prev[songId] || []).filter((c) => c._id !== commentId)
      }));
    } catch {}
    setCommentLoading((prev) => ({ ...prev, [songId]: false }));
  };

  // Helper: time ago
  const timeAgo = (date) => {
    const now = new Date();
    const d = new Date(date);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Auto-scroll to latest comment
  useEffect(() => {
    Object.keys(commentsBySong).forEach(songId => {
      if (commentsEndRefs.current[songId]) {
        commentsEndRefs.current[songId].scrollIntoView({ behavior: 'smooth' });
      }
    });
  }, [commentsBySong]);

  // Recording handlers:
  const startRecording = async (songId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Audio recording not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new window.MediaRecorder(stream);
      let chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlobs(prev => ({ ...prev, [songId]: blob }));
        setAudioURLs(prev => ({ ...prev, [songId]: URL.createObjectURL(blob) }));
        setRecording(prev => ({ ...prev, [songId]: false }));
        clearInterval(recordingTimers.current[songId]);
      };
      setMediaRecorders(prev => ({ ...prev, [songId]: recorder }));
      setRecording(prev => ({ ...prev, [songId]: true }));
      setRecordingTime(prev => ({ ...prev, [songId]: 0 }));
      chunks = [];
      recorder.start();
      recordingTimers.current[songId] = setInterval(() => {
        setRecordingTime(prev => ({ ...prev, [songId]: (prev[songId] || 0) + 1 }));
      }, 1000);
    } catch (err) {
      alert('Could not start recording: ' + err.message);
    }
  };
  const stopRecording = (songId) => {
    if (mediaRecorders[songId]) {
      mediaRecorders[songId].stop();
      setMediaRecorders(prev => ({ ...prev, [songId]: null }));
    }
  };
  const cancelRecording = (songId) => {
    setRecording(prev => ({ ...prev, [songId]: false }));
    setAudioBlobs(prev => ({ ...prev, [songId]: null }));
    setAudioURLs(prev => ({ ...prev, [songId]: null }));
    setRecordingTime(prev => ({ ...prev, [songId]: 0 }));
    clearInterval(recordingTimers.current[songId]);
  };
  const sendAudioComment = async (songId) => {
    if (!audioBlobs[songId]) return;
    setCommentLoading((prev) => ({ ...prev, [songId]: true }));
    try {
      const formData = new FormData();
      formData.append('audio', audioBlobs[songId], 'comment.webm');
      // Optionally include text
      const text = (commentInputs[songId] || '').trim();
      if (text) formData.append('text', text);
      const res = await axios.post(`${API_URL}/api/songs/${songId}/comments/audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCommentsBySong((prev) => ({ ...prev, [songId]: [...(prev[songId] || []), res.data] }));
      setCommentInputs((prev) => ({ ...prev, [songId]: '' }));
      setAudioBlobs(prev => ({ ...prev, [songId]: null }));
      setAudioURLs(prev => ({ ...prev, [songId]: null }));
      setRecordingTime(prev => ({ ...prev, [songId]: 0 }));
    } catch {}
    setCommentLoading((prev) => ({ ...prev, [songId]: false }));
  };

  // Custom delete handler for Muskan
  const handleDeleteWithPassword = (songId) => {
    setDeleteSongId(songId);
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteModal(true);
  };
  const handleConfirmDelete = () => {
    if (deletePassword === 'delete') {
      onDelete(deleteSongId);
      setShowDeleteModal(false);
      setDeletePassword('');
      setDeleteSongId(null);
      setDeleteError('');
      notify('Song deleted!');
    } else {
      setDeleteError('Incorrect password!');
      notify('Incorrect password!');
    }
  };
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeletePassword('');
    setDeleteSongId(null);
    setDeleteError('');
  };

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (showDeleteModal) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [showDeleteModal]);

  // For sharing, show a toast when the share action is triggered (e.g., after copying link)
  const handleShare = (song) => {
    const url = song.cloudinaryUrl;
    const title = song.title;
    if (navigator.share) {
      navigator.share({
        title: `Listen to ${title}`,
        text: `Check out this song: ${title}`,
        url
      }).then(() => notify('Shared!')).catch(() => notify('Share cancelled'));
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => notify('Song link copied!'))
        .catch(() => {
          window.prompt('Copy this link:', url);
          notify('Copy the link manually');
        });
    } else {
      window.prompt('Copy this link:', url);
      notify('Copy the link manually');
    }
  };

  // For emoji picker outside click
  useEffect(() => {
    function handleClickOutside(event) {
      Object.keys(emojiPickerRefs.current).forEach(songId => {
        if (showEmojiPicker[songId] && emojiPickerRefs.current[songId] && !emojiPickerRefs.current[songId].contains(event.target)) {
          setShowEmojiPicker(prev => ({ ...prev, [songId]: false }));
        }
      });
    }
    if (Object.values(showEmojiPicker).some(Boolean)) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleShowPlayHistory = async (song) => {
    setShowPlayHistoryModal(true);
    setPlayHistorySong(song);
    setPlayHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/songs/${song.id || song._id}/play-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlayHistory(res.data);
    } catch (err) {
      setPlayHistory([]);
    }
    setPlayHistoryLoading(false);
  };

  return (
    <>
      {/* Search and Filter Bar */}
      <div className="mb-8">
        <div className="bg-white/80 shadow rounded-xl px-2 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:items-center md:space-x-6 space-y-3 md:space-y-0">
          <div className="flex items-center w-full md:w-auto">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 mr-2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search songs..."
              className="w-full md:w-60 px-3 py-2 rounded-lg border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-gray-50 text-gray-800 transition"
            />
          </div>
          <div className="flex flex-nowrap overflow-x-auto gap-2 items-center pb-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <select
              value={durationFilter}
              onChange={e => setDurationFilter(e.target.value)}
              className="px-2 py-1 sm:px-3 sm:py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs sm:text-sm text-gray-700 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition min-w-[90px]"
            >
              <option value="">All Durations</option>
              <option value="<2">&lt; 2 min</option>
              <option value="2-4">2-4 min</option>
              <option value=">4">&gt; 4 min</option>
            </select>
            <select
              value={playsFilter}
              onChange={e => setPlaysFilter(e.target.value)}
              className="px-2 py-1 sm:px-3 sm:py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs sm:text-sm text-gray-700 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition min-w-[80px]"
            >
              <option value="">All Plays</option>
              <option value="<10">&lt; 10</option>
              <option value="10-50">10-50</option>
              <option value=">50">&gt; 50</option>
            </select>
            <select
              value={playTimeFilter}
              onChange={e => setPlayTimeFilter(e.target.value)}
              className="px-2 py-1 sm:px-3 sm:py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs sm:text-sm text-gray-700 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition min-w-[100px]"
            >
              <option value="">All Play Time</option>
              <option value="<10m">&lt; 10 min</option>
              <option value="10-30m">10-30 min</option>
              <option value=">30m">&gt; 30 min</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-2 py-1 sm:px-3 sm:py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs sm:text-sm text-gray-700 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition min-w-[110px]"
            >
              <option value="recent">Recently Added</option>
              <option value="alpha">Alphabetically</option>
              <option value="plays">Most Played</option>
            </select>
            {(search || durationFilter || playsFilter || playTimeFilter) && (
              <button
                className="ml-2 px-2 py-1 sm:px-3 sm:py-2 rounded-lg text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition"
                onClick={() => { setSearch(''); setDurationFilter(''); setPlaysFilter(''); setPlayTimeFilter(''); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {/* No songs yet or no songs found messages */}
        {songs.length === 0 ? (
          <div className="text-center py-8">
            <MusicalNoteIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No songs yet</h3>
            <p className="text-gray-500 text-sm">Upload your first song to get started!</p>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-8">
            <MusicalNoteIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No songs found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your search or filters.</p>
          </div>
        ) : null}
      </div>
      {/* Song List */}
    <div className="space-y-4">
        {sortedSongs.map((song) => {
        const isPlaying = playingSong?.id === song.id;
          // Use permanent uploadIndex if present, else fallback to uploadOrderMap
          const songNumber = song.uploadIndex || uploadOrderMap[song.id];
        
        return (
            <div key={song.id} className="card p-6 relative">
              {/* Song Number in top-right, improved design */}
              <div
                className="absolute right-4 top-2 text-2xl font-bold select-none pointer-events-none"
                style={{
                  color: 'rgba(232, 80, 140, 0.5)', // soft pink
                  // textShadow: '0 0 8px #f8bbd0, 0 0 16px #f8bbd0, 0 1px 0 #fff', // pinkish glow
                  letterSpacing: '0.04em',
                  filter: 'brightness(1.1)'
                }}
              >
                #{songNumber}
              </div>
              <div className="flex items-center justify-between mt-2">
              {/* Song Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {song.title}
                  </h3>
                  <button
                    onClick={() => isPlaying ? handlePause(song) : handlePlay(song)}
                    disabled={loadingSongId === song.id}
                    className={`ml-1 p-2 rounded-full transition-all duration-200 ${
                      isPlaying
                        ? 'bg-romantic-500 text-white hover:bg-romantic-600'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    } ${loadingSongId === song.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ minWidth: 36, minHeight: 36 }}
                  >
                    {isPlaying ? (
                      <PauseIcon className="h-5 w-5" />
                    ) : loadingSongId === song.id ? (
                      <span className="inline-block align-middle"><span role="img" aria-label="love">💕</span></span>
                    ) : (
                      <PlayIcon className="h-5 w-5" />
                    )}
                  </button>
                  {isPlaying && (
                    <button
                      className="ml-2 px-2 py-1 text-xs rounded bg-primary-100 text-primary-700 hover:bg-primary-200 border border-primary-200 transition-all duration-200"
                      onClick={() => {
                        const audio = audioRefs.current[song.id];
                        const current = audio?.playbackRate || 1;
                        const next = getNextSpeed(current);
                        handleSpeedChange(song, next);
                      }}
                    >
                      {audioRefs.current[song.id]?.playbackRate || 1}x
                    </button>
                  )}
                  {getListeners(song).length > 0 && (
                    <div className="flex items-center space-x-2">
                      {getListeners(song).includes('M') && user.role === 'V' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-600 border border-pink-200 animate-pulse">
                          <span className="w-2 h-2 bg-pink-500 rounded-full mr-1"></span>M is listening
                        </span>
                      )}
                      {getListeners(song).includes('V') && user.role === 'M' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600 border border-blue-200 animate-pulse">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>V is listening
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* Responsive Info Bar for Song Details */}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3 items-start sm:items-center bg-gray-50 rounded-lg px-2 sm:px-4 py-2 mb-1 border border-gray-100 shadow-sm">
                  {/* Row 1: Duration & Upload Time */}
                  <div className="flex flex-row gap-2 w-full sm:w-auto">
                    <span className="flex items-center text-xs text-gray-700 font-semibold bg-white/80 rounded px-2 py-1 shadow-sm" title="Duration">
                      <svg className="h-4 w-4 mr-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /></svg>
                      {song.duration}
                    </span>
                    <span className="flex items-center text-xs text-gray-700 font-semibold bg-white/80 rounded px-2 py-1 shadow-sm" title="Uploaded on">
                      <svg className="h-4 w-4 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 2v4M8 2v4M3 10h18" /></svg>
                      {(() => {
                        const d = new Date(song.uploadTime);
                        const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                        return `${date}, ${time}`;
                      })()}
                    </span>
                  </div>
                  {/* Row 2: Download/Share/Delete Buttons (mobile: order-2, sm+: order-2) */}
                  <div className="flex flex-row gap-2 w-full sm:w-auto order-2">
                    <button
                      className="flex items-center px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs font-medium transition"
                      title="Download"
                      onClick={() => handleDownload(song)}
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v12" /></svg>
                      Download
                    </button>
                    <button
                      className="flex items-center px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs font-medium transition"
                      title="Share"
                      onClick={() => handleShare(song)}
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="2"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="2"/></svg>
                      Share
                    </button>
                    {userRole === 'M' && (
                      <button
                        className="flex items-center px-2 py-1 rounded bg-gray-100 hover:bg-red-100 border border-gray-200 text-red-500 text-xs font-medium transition"
                        onClick={() => handleDeleteWithPassword(song.id)}
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" /> Delete
                      </button>
                    )}
                  </div>
                  {/* Row 3: Play Count & Play Time (mobile: order-3, sm+: order-2) */}
                  <div className="flex flex-row gap-2 w-full sm:w-auto justify-center order-3 sm:order-2">
                    <span
                      className="flex items-center text-base font-extrabold bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-full px-3 sm:px-4 py-1 shadow-lg border-2 border-pink-300 ring-2 ring-pink-200/60 cursor-pointer hover:scale-105 transition"
                      style={{boxShadow:'0 2px 12px 0 rgba(232,80,140,0.15)'}}
                      title="Total plays (Vinay)"
                      onClick={() => handleShowPlayHistory(song)}
                    >
                      <svg className="h-5 w-5 mr-2 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 18v-6a9 9 0 0118 0v6" /><circle cx="12" cy="18" r="4" strokeWidth="2" /></svg>
                      {song.playCounts?.V ?? 0}
                    </span>
                    <span className="flex items-center text-sm font-bold bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 rounded-full px-2 sm:px-3 py-1 shadow border border-amber-200" title="Total play time (Vinay)">
                      <svg className="h-4 w-4 mr-1 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /></svg>
                      {(() => {
                        const durationSec = durationToSeconds(song.duration);
                        const playTime = (song.playCounts?.V ?? 0) * durationSec;
                        return formatPlayTime(playTime);
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar: Show for last played song, even if paused, until another song is played or page is refreshed */}
            {(playingSong?.id === song.id || (playingSong === null && lastPlayedSongId === song.id && lastPlayedTime > 0)) && (
                <div className="flex items-center w-full mt-4">
                  {/* Time left of bar */}
                  <span className="font-mono text-xs text-gray-500 mr-2" style={{minWidth: 44, textAlign: 'right'}}>
                    {(() => {
                      let time = 0;
                      if (playingSong?.id === song.id) {
                        time = currentTime;
                      } else if (lastPlayedSongId === song.id) {
                        time = lastPlayedTime;
                      }
                      return `${Math.floor(time / 60)}:${(Math.floor(time) % 60).toString().padStart(2, '0')}`;
                    })()}
                  </span>
                  <div
                    className="relative flex-1 h-4 flex items-center group cursor-pointer select-none"
                    onMouseDown={e => {
                      const bar = e.currentTarget;
                      const rect = bar.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percent = Math.max(0, Math.min(1, x / rect.width));
                      const audio = audioRefs.current[song.id];
                      if (audio && audio.duration) {
                        setDragging(true);
                        setDragTime(percent * audio.duration);
                      }
                    }}
                    onMouseMove={e => {
                      if (!dragging) return;
                      const bar = e.currentTarget;
                      const rect = bar.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percent = Math.max(0, Math.min(1, x / rect.width));
                      const audio = audioRefs.current[song.id];
                      if (audio && audio.duration) {
                        setDragTime(percent * audio.duration);
                      }
                    }}
                    onMouseUp={e => {
                      if (!dragging) return;
                      const bar = e.currentTarget;
                      const rect = bar.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percent = Math.max(0, Math.min(1, x / rect.width));
                      const audio = audioRefs.current[song.id];
                      if (audio && audio.duration) {
                        audio.currentTime = percent * audio.duration;
                        setCurrentTime(audio.currentTime);
                        if (!playingSong || playingSong.id !== song.id) {
                          // If paused, update lastPlayedTime for this song
                          setLastPlayedSongId(song.id);
                          setLastPlayedTime(audio.currentTime);
                        }
                      }
                      setDragging(false);
                      setDragTime(null);
                    }}
                    onMouseLeave={() => {
                      if (dragging) {
                        setDragging(false);
                        setDragTime(null);
                      }
                    }}
                  >
                    <div className="bg-gray-200 rounded-full h-2 w-full absolute top-1/2 left-0 -translate-y-1/2"></div>
                    <div
                      className="bg-primary-500 h-2 rounded-full absolute top-1/2 left-0 -translate-y-1/2 transition-all duration-300"
                      style={{ width: `${((dragging && dragTime != null ? dragTime : (playingSong?.id === song.id ? currentTime : lastPlayedSongId === song.id ? lastPlayedTime : 0)) / (audioRefs.current[song.id]?.duration || durationToSeconds(song.duration) || 1)) * 100}%` }}
                    ></div>
                    {/* Draggable thumb */}
                    <div
                      className="absolute z-10"
                      style={{
                        left: `calc(${((dragging && dragTime != null ? dragTime : (playingSong?.id === song.id ? currentTime : lastPlayedSongId === song.id ? lastPlayedTime : 0)) / (audioRefs.current[song.id]?.duration || durationToSeconds(song.duration) || 1)) * 100}% - 8px)`
                      }}
                    >
                      <div className="w-4 h-4 bg-primary-500 rounded-full shadow border-2 border-white group-hover:scale-110 transition-transform"></div>
                      {/* Tooltip with time on drag/hover */}
                      {dragging && dragTime != null && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-900 text-white text-xs shadow-lg">
                          {(() => {
                            let time = 0;
                            if (playingSong?.id === song.id) {
                              time = currentTime;
                            } else if (lastPlayedSongId === song.id) {
                              time = lastPlayedTime;
                            }
                            return `${Math.floor(time / 60)}:${(Math.floor(time) % 60).toString().padStart(2, '0')}`;
                          })()}
                        </div>
                      )}
                    </div>
                </div>
                  {/* Time right of bar */}
                  <span className="font-mono text-xs text-gray-500 ml-2" style={{minWidth: 44, textAlign: 'left'}}>
                    {(() => {
                      const audio = audioRefs.current[song.id];
                      const dur = audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0
                        ? audio.duration
                        : durationToSeconds(song.duration);
                      return `${Math.floor(dur / 60)}:${(Math.floor(dur) % 60).toString().padStart(2, '0')}`;
                    })()}
                  </span>
              </div>
            )}

            {/* Comments Section */}
            <div className="mt-4">
              <div className="mb-2 flex items-center text-sm font-semibold text-gray-700">
                <span className="mr-2">💬</span> Comments
                <button
                  className="ml-3 text-xs text-primary-500 hover:underline"
                  onClick={() => fetchComments(song.id)}
                  type="button"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto bg-white/60 rounded-lg p-2 border border-gray-100">
                {(commentsBySong[song.id] || []).length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No comments yet.</div>
                ) : (
                  commentsBySong[song.id].map((c, idx, arr) => (
                    <div key={c._id} className={`flex items-start group hover:bg-gray-50 rounded px-2 py-1 transition-all duration-200 ${idx === arr.length-1 ? 'animate-fade-in' : ''}`}
                      style={{animation: idx === arr.length-1 ? 'fadeIn 0.5s' : undefined}}>
                      {/* Avatar */}
                      <span className={`w-7 h-7 flex items-center justify-center rounded-full font-bold mr-2 text-xs ${c.user === 'M' ? 'bg-pink-100 text-pink-500' : 'bg-blue-100 text-blue-500'}`}>{c.user}</span>
                      <span className="flex-1 text-sm text-gray-800">
                        {c.text}
                        {c.audioUrl && (
                          <audio src={c.audioUrl} controls className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg rounded shadow border border-gray-200 my-2" />
                        )}
                      </span>
                      <span className="ml-2 text-xs text-gray-400 whitespace-nowrap">{timeAgo(c.createdAt)}</span>
                      {user?.role === c.user && (
                        <button
                          className="ml-2 text-xs text-red-400 opacity-0 group-hover:opacity-100 transition"
                          onClick={() => deleteComment(song.id, c._id)}
                          title="Delete"
                          disabled={commentLoading[song.id]}
                        >
                          {commentLoading[song.id] ? <span className="animate-spin">⏳</span> : '×'}
                        </button>
                      )}
                    </div>
                  ))
                )}
                {/* Auto-scroll anchor */}
                <div ref={el => commentsEndRefs.current[song.id] = el} />
              </div>
              <div className="flex items-center gap-2 mt-2 bg-white/80 border border-gray-200 rounded-lg px-2 py-1 shadow-sm relative">
                <input
                  type="text"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm px-2 py-2"
                  placeholder="Add a comment..."
                  value={commentInputs[song.id] || ''}
                  onChange={e => setCommentInputs((prev) => ({ ...prev, [song.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') postComment(song.id); }}
                  disabled={commentLoading[song.id] || recording[song.id]}
                />
                <button
                  className="rounded-full p-2 hover:bg-pink-50 transition"
                  onClick={() => setShowEmojiPicker(prev => ({ ...prev, [song.id]: !prev[song.id] }))}
                  disabled={commentLoading[song.id] || recording[song.id]}
                  title="Add emoji"
                >
                  <svg className="h-5 w-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14s1.5 2 4 2 4-2 4-2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9h.01M15 9h.01" /></svg>
                </button>
                <button
                  className={`rounded-full p-2 hover:bg-blue-50 transition ${recording[song.id] ? 'text-red-500' : 'text-blue-400'}`}
                  onClick={() => recording[song.id] ? stopRecording(song.id) : startRecording(song.id)}
                  disabled={commentLoading[song.id]}
                  title={recording[song.id] ? 'Stop recording' : 'Record audio comment'}
                >
                  {recording[song.id] ? (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="6" height="6" rx="1" strokeWidth="2" /><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" /></svg>
                  ) : (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v10m0 0a4 4 0 004-4V7a4 4 0 00-8 0v2a4 4 0 004 4zm0 0v4m-4 0h8" /></svg>
                  )}
                </button>
                <button
                  className="rounded-full p-2 hover:bg-green-50 transition text-green-500 cursor-pointer"
                  onClick={() => postComment(song.id)}
                  disabled={commentLoading[song.id] || !(commentInputs[song.id] || '').trim() || recording[song.id]}
                  title="Post comment"
                  style={{ cursor: 'pointer' }}
                >
                  {commentLoading[song.id] ? (
                    <span className="animate-spin">💕</span>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 2L11 13" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                  )}
                </button>
                {/* Emoji Picker */}
                {showEmojiPicker[song.id] && (
                  <div
                    ref={el => { emojiPickerRefs.current[song.id] = el; }}
                    className="absolute z-30 bottom-full left-3/4 -translate-x-1/2 mb-2"
                  >
                    <EmojiPicker
                      onEmojiClick={(emojiData) => setCommentInputs(prev => ({ ...prev, [song.id]: (prev[song.id] || '') + emojiData.emoji }))}
                      theme="light"
                      width={300}
                    />
                  </div>
                )}
              </div>
              {/* Recording UI */}
              {recording[song.id] && (
                <div className="flex items-center mt-2 space-x-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span className="text-red-500 font-semibold">● Recording...</span>
                  <span className="text-xs text-gray-700">{recordingTime[song.id] || 0}s</span>
                  <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => cancelRecording(song.id)}>Cancel</button>
                  <button className="text-xs text-blue-500 font-semibold" onClick={() => stopRecording(song.id)}>Stop</button>
                </div>
              )}
              {/* Audio preview UI */}
              {audioURLs[song.id] && !recording[song.id] && (
                <div className="flex items-center mt-2 space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <audio src={audioURLs[song.id]} controls className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg rounded shadow border border-gray-200 my-2" />
                  <button className="text-xs text-green-600 font-semibold" onClick={() => sendAudioComment(song.id)} disabled={commentLoading[song.id]}>Send</button>
                  <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => cancelRecording(song.id)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    {/* Delete Password Modal */}
    {showDeleteModal && (
      <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xs border-2 border-pink-200">
            <h3 className="text-lg font-bold text-pink-600 mb-2 text-center">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-4 text-center">Enter password to delete this song:</p>
            <input
              type="password"
              className="w-full px-4 py-2 border border-pink-300 rounded-lg focus:ring-2 focus:ring-pink-200 focus:border-pink-400 mb-2 text-center"
              placeholder="Password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              autoFocus
            />
            {deleteError && <div className="text-xs text-red-500 mb-2 text-center">{deleteError}</div>}
            <div className="flex justify-center gap-3 mt-2">
              <button
                className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600 transition"
                onClick={handleConfirmDelete}
              >Delete</button>
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
                onClick={handleCancelDelete}
              >Cancel</button>
            </div>
          </div>
        </div>
      </ModalPortal>
    )}
    {/* Play History Modal */}
    {showPlayHistoryModal && (
      <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={e => {
          if (e.target === e.currentTarget) setShowPlayHistoryModal(false);
        }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md border-2 border-pink-200 relative" onMouseDown={e => e.stopPropagation()}>
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setShowPlayHistoryModal(false)}
              title="Close"
            >×</button>
            <h3 className="text-lg font-bold text-pink-600 mb-2 text-center">Play History</h3>
            <div className="mb-2 text-center text-gray-700 font-semibold">{playHistorySong?.title}</div>
            {playHistoryLoading ? (
              <div className="flex justify-center items-center py-8"><span className="animate-spin text-2xl">💕</span></div>
            ) : playHistory.length === 0 ? (
              <div className="text-center text-gray-400 italic">No play history yet.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-pink-100">
                {playHistory.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-1">
                    <span className={`font-bold ${entry.user === 'M' ? 'text-pink-500' : 'text-blue-500'}`}>{entry.user === 'M' ? 'Muskan' : 'Vinay'}</span>
                    <span className="text-xs text-gray-700">{new Date(entry.playedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalPortal>
    )}
    </>
  );
};

export default SongList; 