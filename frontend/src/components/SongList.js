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
      }

      setPlayingSong(song);
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
    // Add ?dl=1 to force download from Cloudinary
    link.href = song.cloudinaryUrl + (song.cloudinaryUrl.includes('?') ? '&' : '?') + 'dl=1';
    link.download = `${song.title}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                  {getListeners(song).length > 0 && (
                    <div className="flex items-center space-x-2">
                      {getListeners(song).includes('M') && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-600 border border-pink-200 animate-pulse">
                          <span className="w-2 h-2 bg-pink-500 rounded-full mr-1"></span>M is listening
                        </span>
                      )}
                      {getListeners(song).includes('V') && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600 border border-blue-200 animate-pulse">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>V is listening
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* Modern Info Bar for Song Details - ICONS ONLY, NO LABELS */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 items-start sm:items-center bg-gray-50 rounded-lg px-2 sm:px-4 py-2 mb-1 border border-gray-100 shadow-sm">
                  {/* Duration */}
                  <span className="flex items-center text-xs text-gray-700 font-semibold bg-white/80 rounded px-2 py-1 shadow-sm" title="Duration">
                    <svg className="h-4 w-4 mr-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /></svg>
                    {song.duration}
                  </span>
                  {/* Date & Time Together */}
                  <span className="flex items-center text-xs text-gray-700 font-semibold bg-white/80 rounded px-2 py-1 shadow-sm" title="Uploaded on">
                    <svg className="h-4 w-4 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 2v4M8 2v4M3 10h18" /></svg>
                    {(() => {
                      const d = new Date(song.uploadTime);
                      const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                      return `${date}, ${time}`;
                    })()}
                  </span>
                  {/* Total Plays (V) - SPECIAL BADGE */}
                  <span className="flex items-center text-base font-extrabold bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-full px-3 sm:px-4 py-1 shadow-lg border-2 border-pink-300 ring-2 ring-pink-200/60" style={{boxShadow:'0 2px 12px 0 rgba(232,80,140,0.15)'}} title="Total plays (Vinay)">
                    <svg className="h-5 w-5 mr-2 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 18v-6a9 9 0 0118 0v6" /><circle cx="12" cy="18" r="4" strokeWidth="2" /></svg>
                    {song.playCounts?.V ?? 0}
                  </span>
                  {/* Total Play Time (V) - PROMINENT BADGE */}
                  <span className="flex items-center text-sm font-bold bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 rounded-full px-2 sm:px-3 py-1 shadow border border-amber-200" title="Total play time (Vinay)">
                    <svg className="h-4 w-4 mr-1 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /></svg>
                    {(() => {
                      const durationSec = durationToSeconds(song.duration);
                      const playTime = (song.playCounts?.V ?? 0) * durationSec;
                      return formatPlayTime(playTime);
                    })()}
                  </span>
                  {/* Download and Share Buttons */}
                  <button
                    className="ml-0 sm:ml-2 flex items-center px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs font-medium transition"
                    title="Download"
                    onClick={() => handleDownload(song)}
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v12" /></svg>
                    Download
                  </button>
                  <button
                    className="flex items-center px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs font-medium transition"
                    title="Share"
                    onClick={() => setSharePopoverId(song.id)}
                  >
                    <ShareIcon className="h-4 w-4 mr-1" />
                    Share
                  </button>
                </div>
                {/* Play Counts (M/V) - removed as per request */}
              </div>

              {/* Controls */}
              <div className="flex flex-col xs:flex-row flex-wrap items-center gap-2 sm:gap-3 justify-center ml-0 sm:ml-4 mt-3 sm:mt-0">
                  {/* Speed Controls (left of play/pause) */}
                  {isPlaying && (
                    <div className="flex items-center mr-2">
                      <button
                        className="px-2 py-1 text-xs rounded bg-primary-500 text-white hover:bg-primary-600 transition-all duration-200"
                        onClick={() => {
                          const audio = audioRefs.current[song.id];
                          const current = audio?.playbackRate || 1;
                          const next = getNextSpeed(current);
                          handleSpeedChange(song, next);
                        }}
                      >
                        {audioRefs.current[song.id]?.playbackRate || 1}x
                      </button>
                    </div>
                  )}
                {/* Play/Pause Button */}
                <button
                  onClick={() => isPlaying ? handlePause(song) : handlePlay(song)}
                    disabled={loadingSongId === song.id}
                  className={`p-3 rounded-full transition-all duration-200 ${
                    isPlaying
                      ? 'bg-romantic-500 text-white hover:bg-romantic-600'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                    } ${loadingSongId === song.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isPlaying ? (
                    <PauseIcon className="h-5 w-5" />
                    ) : loadingSongId === song.id ? (
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                  ) : (
                    <PlayIcon className="h-5 w-5" />
                  )}
                </button>

                {/* Download Button */}
                <button
                  onClick={() => handleDownload(song)}
                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  title="Download song"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>

                {/* Delete Button (Muskan only) */}
                {userRole === 'M' && (
                  <button
                    onClick={() => onDelete(song.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Delete song"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}

                  {/* Share Button */}
                  <div className="relative">
                    <button
                      onClick={async () => {
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: song.title,
                              text: `Listen to this song: ${song.title}`,
                              url: song.cloudinaryUrl
                            });
                          } catch (e) {}
                        } else {
                          setSharePopoverId(sharePopoverId === song.id ? null : song.id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                      title="Share song"
                    >
                      <ShareIcon className="h-5 w-5" />
                    </button>
                    {/* Popover for social share links */}
                    {sharePopoverId === song.id && (
                      <div className="absolute z-20 right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg p-3 flex flex-col space-y-2 animate-fade-in">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent('Listen to this song: ' + song.title + ' ' + song.cloudinaryUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline flex items-center"
                        >
                          <span className="mr-2">🟢</span> WhatsApp
                        </a>
                        <a
                          href={`https://www.instagram.com/?url=${encodeURIComponent(song.cloudinaryUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-500 hover:underline flex items-center"
                        >
                          <span className="mr-2">🟣</span> Instagram
                        </a>
                        <a
                          href={`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(song.cloudinaryUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-yellow-500 hover:underline flex items-center"
                        >
                          <span className="mr-2">🟡</span> Snapchat
                        </a>
                        <button
                          onClick={() => setSharePopoverId(null)}
                          className="mt-2 text-xs text-gray-400 hover:text-gray-700"
                        >Close</button>
                      </div>
                    )}
                  </div>
              </div>
            </div>

            {/* Progress Bar */}
            {isPlaying && (
                <div className="flex items-center w-full mt-4">
                  {/* Time left of bar */}
                  <span className="font-mono text-xs text-gray-500 mr-2" style={{minWidth: 44, textAlign: 'right'}}>
                    {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}
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
                      style={{ width: `${((dragging && dragTime != null ? dragTime : currentTime) / (audioRefs.current[song.id]?.duration || durationToSeconds(song.duration) || 1)) * 100}%` }}
                  ></div>
                    {/* Draggable thumb */}
                    <div
                      className="absolute z-10"
                      style={{
                        left: `calc(${((dragging && dragTime != null ? dragTime : currentTime) / (audioRefs.current[song.id]?.duration || durationToSeconds(song.duration) || 1)) * 100}% - 8px)`
                      }}
                    >
                      <div className="w-4 h-4 bg-primary-500 rounded-full shadow border-2 border-white group-hover:scale-110 transition-transform"></div>
                      {/* Tooltip with time on drag/hover */}
                      {dragging && dragTime != null && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-900 text-white text-xs shadow-lg">
                          {Math.floor(dragTime / 60)}:{(Math.floor(dragTime) % 60).toString().padStart(2, '0')}
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
              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 mt-2">
                <input
                  type="text"
                  className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition"
                  placeholder="Add a comment..."
                  value={commentInputs[song.id] || ''}
                  onChange={e => setCommentInputs((prev) => ({ ...prev, [song.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') postComment(song.id); }}
                  disabled={commentLoading[song.id] || recording[song.id]}
                />
                <button
                  className="rounded-lg px-2 py-2 bg-gray-50 hover:bg-gray-100 text-xl"
                  onClick={() => setShowEmojiPicker(prev => ({ ...prev, [song.id]: !prev[song.id] }))}
                  disabled={commentLoading[song.id] || recording[song.id]}
                >😊</button>
                <button
                  className={`rounded-lg px-2 py-2 bg-gray-50 hover:bg-gray-100 text-xl ${recording[song.id] ? 'text-red-500' : ''}`}
                  onClick={() => recording[song.id] ? stopRecording(song.id) : startRecording(song.id)}
                  disabled={commentLoading[song.id]}
                  title={recording[song.id] ? 'Stop recording' : 'Record audio comment'}
                >{recording[song.id] ? '■' : '🎤'}</button>
                <button
                  className="btn-primary px-4 py-2 text-sm font-semibold rounded-lg"
                  onClick={() => postComment(song.id)}
                  disabled={commentLoading[song.id] || !(commentInputs[song.id] || '').trim() || recording[song.id]}
                >{commentLoading[song.id] ? <span className="animate-spin">⏳</span> : 'Post'}</button>
                {/* Emoji Picker */}
                {showEmojiPicker[song.id] && (
                  <div className="absolute z-30 bottom-10 left-0">
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
    </>
  );
};

export default SongList; 