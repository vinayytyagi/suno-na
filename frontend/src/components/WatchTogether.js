import React, { useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import { useSocket } from '../contexts/SocketContext';
import { MdPlayArrow, MdPause, MdVolumeOff, MdVolumeUp, MdLoop, MdSkipNext, MdSkipPrevious, MdReplay10, MdForward10, MdSwitchCamera, MdCallEnd, MdFlipCameraAndroid, MdMic, MdMicOff } from 'react-icons/md';
import { FaHeart } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import TwilioVideoCall from './TwilioVideoCall';

const WATCH_ROOM = 'watch-together';

const NotificationBar = ({ message, onClose }) => (
  <div className="fixed sm:absolute top-2 sm:top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-full shadow-lg flex items-center gap-2 animate-fade-in max-w-[95vw] sm:max-w-fit text-sm sm:text-base w-[95vw] sm:w-auto">
    <span className="truncate max-w-[70vw] sm:max-w-none">{message}</span>
    <button onClick={onClose} className="ml-2 text-white font-bold text-lg sm:text-xl">×</button>
  </div>
);

const WatchTogether = () => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const playerRef = useRef(null);
  const [videoId, setVideoId] = useState('');
  const [inputId, setInputId] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState({
    playing: false,
    currentTime: 0,
  });
  const [isSeeking, setIsSeeking] = useState(false);
  const [error, setError] = useState('');
  const isRemoteAction = useRef(false);
  const isSyncing = useRef(false); // Prevent multiple sync responses
  const [pendingSyncState, setPendingSyncState] = useState(null); // For syncing before player is ready
  const [muted, setMuted] = useState(true); // Track mute state
  const [isLooping, setIsLooping] = useState(false); // Track loop state
  const [isPlaying, setIsPlaying] = useState(false); // Track play/pause state
  const prevVideoIdRef = useRef(videoId);
  const [wtOnline, setWtOnline] = useState({ M: false, V: false });
  const [notification, setNotification] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerConnectionRef = useRef(null);
  const [screenStream, setScreenStream] = useState(null);
  const [partnerTabChanged, setPartnerTabChanged] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState(null);
  const [remoteVideoStream, setRemoteVideoStream] = useState(null);
  const [videoFacingMode, setVideoFacingMode] = useState('user'); // 'user' (front) or 'environment' (rear)
  const videoCallPeerRef = useRef(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [audioWarning, setAudioWarning] = useState('');
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState('');
  const [isMirrored, setIsMirrored] = useState(false); // Add this near other useState hooks
  const [showTwilioCall, setShowTwilioCall] = useState(false); // Twilio video call state

  // List available audio input devices for debugging
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedAudioDeviceId) {
        setSelectedAudioDeviceId(audioInputs[0].deviceId);
      }
    });
  }, []);

  // Join the watch room on mount and request sync
  useEffect(() => {
    if (socket) {
      socket.emit('joinWatchRoom', WATCH_ROOM);
      // Request sync if joining late
      setTimeout(() => {
        socket.emit('syncRequest', { roomId: WATCH_ROOM });
      }, 500); // slight delay to ensure join
    }
  }, [socket]);

  // Handle incoming socket events
  useEffect(() => {
    if (!socket) return;
    // Play event
    socket.on('videoPlay', ({ currentTime }) => {
      if (!playerRef.current || !playerReady) return;
      console.log('[Socket] Received videoPlay', currentTime);
      isRemoteAction.current = true;
      setIsSeeking(true);
      playerRef.current.seekTo(currentTime, true);
      playerRef.current.playVideo();
      setIsPlaying(true);
    });
    // Pause event
    socket.on('videoPause', ({ currentTime }) => {
      if (!playerRef.current || !playerReady) return;
      console.log('[Socket] Received videoPause', currentTime);
      isRemoteAction.current = true;
      setIsSeeking(true);
      playerRef.current.seekTo(currentTime, true);
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    });
    // Seek event
    socket.on('videoSeek', ({ seekTime }) => {
      if (!playerRef.current || !playerReady) return;
      console.log('[Socket] Received videoSeek', seekTime);
      isRemoteAction.current = true;
      setIsSeeking(true);
      playerRef.current.seekTo(seekTime, true);
    });
    // Sync request (send current state to requester)
    socket.on('syncRequest', ({ requester }) => {
      if (!playerRef.current || !videoId || isSyncing.current) return;
      isSyncing.current = true;
      const currentTime = playerRef.current.getCurrentTime();
      const state = playerRef.current.getPlayerState();
      socket.emit('syncState', {
        roomId: WATCH_ROOM,
        state: {
          videoId,
          currentTime,
          playing: state === 1 // 1 = playing
        },
        toSocketId: requester
      });
      setTimeout(() => { isSyncing.current = false; }, 1000); // allow future syncs
    });
    // Sync state (apply received state)
    socket.on('syncState', ({ state }) => {
      if (state) {
        if (state.videoId) setVideoId(state.videoId);
        // If player is ready, sync immediately; else, store for later
        if (playerRef.current && playerReady) {
          setIsSeeking(true);
          playerRef.current.seekTo(state.currentTime || 0, true);
          if (state.playing) {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
        } else {
          setPendingSyncState(state);
        }
      }
    });
    // Video load event
    socket.on('videoLoad', ({ videoId }) => {
      setVideoId(videoId);
    });
    // Video loop event
    socket.on('videoLoop', ({ isLooping }) => {
      setIsLooping(isLooping);
    });
    return () => {
      socket.off('videoPlay');
      socket.off('videoPause');
      socket.off('videoSeek');
      socket.off('syncRequest');
      socket.off('syncState');
      socket.off('videoLoad');
      socket.off('videoLoop');
    };
  }, [socket, videoId, playerReady]);

  useEffect(() => {
    if (!socket || !user?.role) return;
    const emitActive = () => socket.emit('watchTogetherActive', { role: user.role });
    emitActive();
    socket.on('connect', emitActive);
    socket.on('watchTogetherStatus', (status) => {
      setWtOnline(status);
      // Partner joined/left notification
      const myRole = user.role;
      const partnerRole = myRole === 'M' ? 'V' : 'M';
      if (status[partnerRole]) {
        showNotification('Your partner joined the room!');
      } else {
        showNotification('Your partner left the room.');
      }
    });
    socket.on('watchTogetherTabChanged', ({ role, tabChanged }) => {
      const myRole = user.role;
      const partnerRole = myRole === 'M' ? 'V' : 'M';
      if (role === partnerRole) setPartnerTabChanged(tabChanged);
    });
    // Partner actions notifications
    socket.on('videoPlay', ({ currentTime }) => showNotification('Partner played the video.'));
    socket.on('videoPause', ({ currentTime }) => showNotification('Partner paused the video.'));
    socket.on('videoSeek', ({ seekTime }) => showNotification('Partner skipped the video.'));
    socket.on('videoLoad', ({ videoId }) => showNotification('Partner changed the video.'));
    socket.on('videoLoop', ({ isLooping }) => showNotification(`Partner ${isLooping ? 'enabled' : 'disabled'} loop.`));
    socket.on('syncRequest', () => showNotification('Partner clicked resync.'));
    socket.on('syncState', () => showNotification('You have been resynced to your partner.'));
    return () => {
      socket.off('connect', emitActive);
      socket.off('watchTogetherStatus');
      socket.off('watchTogetherTabChanged');
      socket.off('videoPlay');
      socket.off('videoPause');
      socket.off('videoSeek');
      socket.off('videoLoad');
      socket.off('videoLoop');
      socket.off('syncRequest');
      socket.off('syncState');
    };
  }, [socket, user]);

  // YouTube player options
  const opts = {
    height: '390',
    width: '640',
    playerVars: {
      autoplay: 0,
      controls: 1, // Show default controls (including full screen)
      disablekb: 1, // Disable keyboard controls
      modestbranding: 1,
      rel: 0,
    },
  };

  // Handle player ready
  const onReady = (event) => {
    playerRef.current = event.target;
    setIsReady(true);
    setPlayerReady(true);
    // If there is a pending sync and the videoId matches, apply it now
    if (pendingSyncState && videoId && pendingSyncState.videoId === videoId) {
      setIsSeeking(true);
      playerRef.current.seekTo(pendingSyncState.currentTime || 0, true);
      playerRef.current.mute(); // Always mute for autoplay
      playerRef.current.playVideo(); // Always autoplay after refresh/late join
      setIsPlaying(true);
      setPendingSyncState(null);
    }
  };

  // Handle play/pause/seek events
  const onStateChange = (event) => {
    if (!isReady || isSeeking) {
      setIsSeeking(false);
      return;
    }
    if (!playerRef.current) return;
    if (isRemoteAction.current) {
      console.log('[Player] onStateChange (remote), ignoring emit', event.data);
      isRemoteAction.current = false;
      return;
    }
    const ytState = event.data;
    const currentTime = playerRef.current.getCurrentTime();
    const currentVideoId = playerRef.current.getVideoData().video_id;
    // Detect if user selected a new video from suggestions
    if (currentVideoId && currentVideoId !== prevVideoIdRef.current) {
      prevVideoIdRef.current = currentVideoId;
      setVideoId(currentVideoId);
      if (socket) {
        socket.emit('videoLoad', { roomId: WATCH_ROOM, videoId: currentVideoId });
      }
      // No need to emit play event here; videoLoad will sync
      return;
    }
    console.log('[Player] onStateChange (local)', ytState, 'currentTime:', currentTime);
    if (ytState === 1) { // Playing
      setIsPlaying(true);
      console.log('[Socket] Emitting videoPlay', currentTime);
      socket.emit('videoPlay', { roomId: WATCH_ROOM, currentTime });
    } else if (ytState === 2) { // Paused
      setIsPlaying(false);
      console.log('[Socket] Emitting videoPause', currentTime);
      socket.emit('videoPause', { roomId: WATCH_ROOM, currentTime });
    }
  };

  // Handle manual seek
  const onSeek = (event) => {
    if (!isReady || isSeeking) {
      setIsSeeking(false);
      return;
    }
    if (!playerRef.current) return;
    if (isRemoteAction.current) {
      console.log('[Player] onSeek (remote), ignoring emit');
      isRemoteAction.current = false;
      return;
    }
    const seekTime = playerRef.current.getCurrentTime();
    console.log('[Socket] Emitting videoSeek', seekTime);
    socket.emit('videoSeek', { roomId: WATCH_ROOM, seekTime });
  };

  // Helper to extract YouTube video ID from URL or return raw ID
  const extractVideoId = (input) => {
    // Regex for YouTube video ID
    const idRegex = /^[a-zA-Z0-9_-]{11}$/;
    if (idRegex.test(input)) return input;
    // Try to extract from URL
    const urlRegex = /(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/;
    const match = input.match(urlRegex);
    return match ? match[1] : null;
  };

  // Handle video ID input
  const handleSetVideo = (e) => {
    e.preventDefault();
    setError('');
    const id = extractVideoId(inputId.trim());
    if (!id) {
      setError('Please enter a valid YouTube video ID or URL.');
      return;
    }
    setVideoId(id);
    if (socket) {
      socket.emit('videoLoad', { roomId: WATCH_ROOM, videoId: id });
    }
  };

  // Play/Pause toggle handler
  const handlePlayPause = () => {
    if (!playerRef.current || !playerReady) return;
    const currentTime = playerRef.current.getCurrentTime();
    if (isPlaying) {
      playerRef.current.pauseVideo();
      socket.emit('videoPause', { roomId: WATCH_ROOM, currentTime });
    } else {
      playerRef.current.playVideo();
      socket.emit('videoPlay', { roomId: WATCH_ROOM, currentTime });
    }
  };

  // Custom mute/unmute button
  const handleMuteToggle = () => {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute();
      setMuted(false);
    } else {
      playerRef.current.mute();
      setMuted(true);
    }
  };

  // Custom 10s forward/backward controls
  const handleSeek = (offset) => {
    if (!playerRef.current) return;
    const currentTime = playerRef.current.getCurrentTime();
    const seekTime = Math.max(0, currentTime + offset);
    playerRef.current.seekTo(seekTime, true);
    socket.emit('videoSeek', { roomId: WATCH_ROOM, seekTime });
  };

  // Custom loop control
  const handleLoopToggle = () => {
    const newLoop = !isLooping;
    setIsLooping(newLoop);
    if (socket) {
      socket.emit('videoLoop', { roomId: WATCH_ROOM, isLooping: newLoop });
    }
  };

  // Listen for video end and loop if enabled
  const onEnd = () => {
    if (isLooping && playerRef.current) {
      playerRef.current.seekTo(0, true);
      playerRef.current.playVideo();
      socket.emit('videoSeek', { roomId: WATCH_ROOM, seekTime: 0 });
    }
  };

  // Keep prevVideoIdRef in sync with videoId from our own code
  useEffect(() => {
    prevVideoIdRef.current = videoId;
  }, [videoId]);

  // Resync handler
  const handleResync = () => {
    if (socket) {
      socket.emit('syncRequest', { roomId: WATCH_ROOM });
    }
  };

  // Determine partner's role
  const myRole = user?.role;
  const partnerRole = myRole === 'M' ? 'V' : 'M';
  const partnerOnline = wtOnline[partnerRole];

  // Tab change/refresh notification and emit to partner
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && isPlaying) {
        showNotification('You changed tab or refreshed while video is playing!');
        if (socket && user?.role) socket.emit('watchTogetherTabChanged', { role: user.role, tabChanged: true });
      } else if (document.visibilityState === 'visible' && isPlaying) {
        if (socket && user?.role) socket.emit('watchTogetherTabChanged', { role: user.role, tabChanged: false });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isPlaying, socket, user]);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Screen share logic
  const handleShareScreen = async () => {
    if (!socket) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setIsSharing(true);
      setScreenStream(stream);
      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;
      // Add tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      // Send offer
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screenShareCandidate', { candidate: event.candidate, roomId: WATCH_ROOM });
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('screenShareOffer', { offer, roomId: WATCH_ROOM });
      // Stop sharing handler
      stream.getVideoTracks()[0].onended = () => {
        setIsSharing(false);
        setScreenStream(null);
        socket.emit('screenShareStop', { roomId: WATCH_ROOM });
        pc.close();
        peerConnectionRef.current = null;
      };
    } catch (err) {
      setIsSharing(false);
      setScreenStream(null);
    }
  };

  // Stop sharing handler
  const handleStopShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setIsSharing(false);
      setScreenStream(null);
      socket.emit('screenShareStop', { roomId: WATCH_ROOM });
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  };

  // Handle incoming screen share
  useEffect(() => {
    if (!socket) return;
    let pc;
    socket.on('screenShareOffer', async ({ offer }) => {
      pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screenShareCandidate', { candidate: event.candidate, roomId: WATCH_ROOM });
        }
      };
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('screenShareAnswer', { answer, roomId: WATCH_ROOM });
    });
    socket.on('screenShareAnswer', async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });
    socket.on('screenShareCandidate', async ({ candidate }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
    socket.on('screenShareStop', () => {
      setRemoteStream(null);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    });
    return () => {
      socket.off('screenShareOffer');
      socket.off('screenShareAnswer');
      socket.off('screenShareCandidate');
      socket.off('screenShareStop');
    };
  }, [socket]);

  // Start video call
  const handleStartCall = async () => {
    if (!socket) return;
    try {
      let constraints = {
        video: { facingMode: videoFacingMode },
        audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // Fallback: try with just audio: true
        console.warn('Failed with deviceId, retrying with audio: true', e);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: videoFacingMode }, audio: true });
      }
      console.log('Local stream tracks:', stream.getTracks());
      if (stream.getAudioTracks().length === 0) {
        setAudioWarning('No audio track found. Please check your microphone permissions.');
      } else {
        setAudioWarning('');
      }
      setIsCalling(true);
      setLocalVideoStream(stream);
      // Create peer connection
      const pc = new RTCPeerConnection();
      videoCallPeerRef.current = pc;
      // Always set ontrack handler
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          console.log('Received remote stream tracks:', event.streams[0].getTracks());
          if (event.streams[0].getAudioTracks().length === 0) {
            setAudioWarning('No audio received from partner. They may have denied mic permission.');
          }
          setRemoteVideoStream(event.streams[0]);
        }
      };
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('videoCallCandidate', { candidate: event.candidate, roomId: WATCH_ROOM });
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('videoCallOffer', { offer, roomId: WATCH_ROOM });
      stream.getVideoTracks()[0].onended = () => handleStopCall();
    } catch (err) {
      setAudioWarning('Could not access microphone/camera. Please allow permissions.');
      setIsCalling(false);
      setLocalVideoStream(null);
    }
  };

  // Switch camera
  const handleSwitchCamera = async () => {
    setVideoFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    if (isCalling) {
      handleStopCall();
      setTimeout(() => handleStartCall(), 500);
    }
  };

  // Stop call
  const handleStopCall = () => {
    if (localVideoStream) {
      localVideoStream.getTracks().forEach(track => track.stop());
      setLocalVideoStream(null);
    }
    setIsCalling(false);
    setRemoteVideoStream(null);
    socket.emit('videoCallStop', { roomId: WATCH_ROOM });
    if (videoCallPeerRef.current) {
      videoCallPeerRef.current.close();
      videoCallPeerRef.current = null;
    }
  };

  // Handle incoming video call
  useEffect(() => {
    if (!socket) return;
    let pc;
    socket.on('videoCallOffer', async ({ offer }) => {
      pc = new RTCPeerConnection();
      videoCallPeerRef.current = pc;
      // Always set ontrack handler
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          console.log('Received remote stream tracks:', event.streams[0].getTracks());
          if (event.streams[0].getAudioTracks().length === 0) {
            setAudioWarning('No audio received from partner. They may have denied mic permission.');
          }
          setRemoteVideoStream(event.streams[0]);
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('videoCallCandidate', { candidate: event.candidate, roomId: WATCH_ROOM });
        }
      };
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      let constraints = {
        video: { facingMode: videoFacingMode },
        audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // Fallback: try with just audio: true
        console.warn('Failed with deviceId, retrying with audio: true', e);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: videoFacingMode }, audio: true });
      }
      console.log('Local stream tracks (answerer):', stream.getTracks());
      if (stream.getAudioTracks().length === 0) {
        setAudioWarning('No audio track found. Please check your microphone permissions.');
      } else {
        setAudioWarning('');
      }
      setIsCalling(true);
      setLocalVideoStream(stream);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('videoCallAnswer', { answer, roomId: WATCH_ROOM });
      stream.getVideoTracks()[0].onended = () => handleStopCall();
    });
    socket.on('videoCallAnswer', async ({ answer }) => {
      if (videoCallPeerRef.current) {
        await videoCallPeerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        // If remote streams are available, set remoteVideoStream
        const remoteStreams = videoCallPeerRef.current.getReceivers()
          .map(r => r.track && r.track.kind === 'video' && r.track)
          .filter(Boolean);
        // This is a workaround: ontrack should fire, but just in case, try to set remoteVideoStream
        if (videoCallPeerRef.current.getRemoteStreams && videoCallPeerRef.current.getRemoteStreams().length > 0) {
          setRemoteVideoStream(videoCallPeerRef.current.getRemoteStreams()[0]);
        }
      }
    });
    socket.on('videoCallCandidate', async ({ candidate }) => {
      if (videoCallPeerRef.current) {
        await videoCallPeerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
    socket.on('videoCallStop', () => {
      setRemoteVideoStream(null);
      if (videoCallPeerRef.current) {
        videoCallPeerRef.current.close();
        videoCallPeerRef.current = null;
      }
      setIsCalling(false);
      setLocalVideoStream(null);
    });
    return () => {
      socket.off('videoCallOffer');
      socket.off('videoCallAnswer');
      socket.off('videoCallCandidate');
      socket.off('videoCallStop');
    };
  }, [socket, videoFacingMode]);

  // Mute/unmute call audio
  const handleCallMuteToggle = () => {
    if (localVideoStream) {
      const audioTracks = localVideoStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newMute = !isCallMuted;
        audioTracks[0].enabled = !newMute;
        setIsCallMuted(newMute);
      }
    }
  };

  // When call ends, reset mute state
  useEffect(() => {
    if (!isCalling) setIsCallMuted(false);
  }, [isCalling]);

  // Change microphone during call
  useEffect(() => {
    if (!isCalling || !selectedAudioDeviceId || !localVideoStream) return;
    // Get new audio track from selected device
    navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedAudioDeviceId } } })
      .then(newStream => {
        const newAudioTrack = newStream.getAudioTracks()[0];
        if (!newAudioTrack) return;
        // Replace audio track in local stream
        const oldAudioTracks = localVideoStream.getAudioTracks();
        oldAudioTracks.forEach(track => {
          localVideoStream.removeTrack(track);
          track.stop();
        });
        localVideoStream.addTrack(newAudioTrack);
        setLocalVideoStream(localVideoStream);
        // Replace audio sender in peer connection
        if (videoCallPeerRef.current) {
          const senders = videoCallPeerRef.current.getSenders();
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(newAudioTrack);
          }
        }
      })
      .catch(err => {
        setAudioWarning('Could not switch microphone: ' + err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAudioDeviceId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-100 via-blue-50 to-rose-100 px-2 sm:px-0">
      <div className="w-full max-w-[400px] sm:max-w-[800px] bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl border border-pink-200 p-4 sm:p-8 flex flex-col items-center relative overflow-visible">
        {notification && <NotificationBar message={notification} onClose={() => setNotification(null)} />}
        {/* <div className="flex items-center justify-center mb-2">
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${partnerOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          <span className="text-sm font-medium text-gray-700">
            {partnerOnline ? `Your partner is online${partnerTabChanged ? ' (tab changed)' : ''}` : 'Waiting for your partner...'}
          </span>
        </div> */}
        <h2 className="text-3xl font-extrabold mb-4 text-center text-pink-600 drop-shadow flex items-center justify-center gap-2 font-cursive">
          <FaHeart className="text-pink-400 animate-pulse" size={32} />
          Watch Together
          <FaHeart className="text-pink-400 animate-pulse" size={32} />
        </h2>
        <form onSubmit={handleSetVideo} className="mb-4 w-full max-w-md flex flex-col sm:flex-row gap-2 sm:gap-0 items-center justify-center">
          <input
            type="text"
            placeholder="Enter YouTube Video ID or URL"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            className="border border-pink-200 px-3 py-2 rounded-lg mr-0 sm:mr-2 w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-pink-300 text-lg bg-white/80"
          />
          <button type="submit" className="bg-pink-400 hover:bg-pink-500 text-white px-6 py-2 rounded-lg w-full sm:w-auto mt-2 sm:mt-0 font-semibold text-lg shadow transition-all duration-150">Load Video</button>
        </form>
        {error && <div className="text-red-500 mb-2 text-center font-medium">{error}</div>}
        {videoId && (
          <>
            <div className="w-full flex justify-center">
              <div
                className="w-full max-w-[320px] h-[180px] sm:max-w-[800px] sm:h-[450px] rounded-2xl overflow-hidden flex items-center justify-center shadow-lg"
              >
                <YouTube
                  videoId={videoId}
                  opts={{ ...opts, width: '100%', height: '100%' }}
                  className="w-full h-full"
                  onReady={onReady}
                  onStateChange={onStateChange}
                  onPlaybackRateChange={onSeek}
                  onPlaybackQualityChange={onSeek}
                  onEnd={onEnd}
                />
              </div>
            </div>
            {/* Desktop controls: loop left, mute right; Mobile: main row, loop/mute below */}
            <div className="w-full max-w-[320px] sm:max-w-[800px] mx-auto">
              {/* Desktop: row with loop, skip, play/pause, skip, mute */}
              <div className="hidden sm:flex flex-nowrap gap-3 mt-6 items-center justify-center w-full">
                <button onClick={handleLoopToggle} title="Loop" className={`px-4 py-2 rounded-full flex items-center justify-center text-xl shadow flex-1 min-w-[60px] transition-all duration-150 ${isLooping ? 'bg-yellow-400 text-black' : 'bg-yellow-100 text-gray-700'}`}> <MdLoop size={24} className={isLooping ? 'animate-spin-slow' : ''} /> </button>
                <button onClick={() => handleSeek(-10)} title="Back 10s" className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-2 rounded-full text-2xl flex items-center justify-center shadow flex-1 min-w-[60px] transition-all duration-150">
                  <MdReplay10 size={32} />
                </button>
                <button onClick={handlePlayPause} title="Play/Pause" className="bg-gradient-to-br from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 text-white w-16 h-16 rounded-full text-3xl flex items-center justify-center shadow-xl border-4 border-white -mx-2 transition-all duration-150">
                  {isPlaying ? <MdPause size={36} /> : <MdPlayArrow size={36} />}
                </button>
                <button onClick={() => handleSeek(10)} title="Forward 10s" className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-2 rounded-full text-2xl flex items-center justify-center shadow flex-1 min-w-[60px] transition-all duration-150">
                  <MdForward10 size={32} />
                </button>
                <button onClick={handleMuteToggle} title="Mute/Unmute" className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-full text-xl flex items-center justify-center shadow flex-1 min-w-[60px] transition-all duration-150">
                  {muted ? <MdVolumeOff size={24} /> : <MdVolumeUp size={24} />}
                </button>
              </div>
              {/* Mobile: main row (skip, play/pause, skip), loop/mute below */}
              <div className="flex sm:hidden flex-nowrap gap-3 mt-6 items-center justify-center w-full">
                <button onClick={() => handleSeek(-10)} title="Back 10s" className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-2 rounded-full text-2xl flex items-center justify-center shadow flex-1 min-w-[60px] transition-all duration-150">
                  <MdReplay10 size={32} />
                </button>
                <button onClick={handlePlayPause} title="Play/Pause" className="bg-gradient-to-br from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 text-white w-16 h-16 rounded-full text-3xl flex items-center justify-center shadow-xl border-4 border-white -mx-2 transition-all duration-150">
                  {isPlaying ? <MdPause size={36} /> : <MdPlayArrow size={36} />}
                </button>
                <button onClick={() => handleSeek(10)} title="Forward 10s" className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-2 rounded-full text-2xl flex items-center justify-center shadow flex-1 min-w-[60px] transition-all duration-150">
                  <MdForward10 size={32} />
                </button>
              </div>
              <div className="flex sm:hidden flex-nowrap gap-3 mt-3 items-center justify-center w-full">
                <button onClick={handleLoopToggle} title="Loop" className={`px-4 py-2 rounded-full flex items-center justify-center text-xl shadow flex-1 min-w-[60px] transition-all duration-150 ${isLooping ? 'bg-yellow-400 text-black' : 'bg-yellow-100 text-gray-700'}`}> <MdLoop size={24} className={isLooping ? 'animate-spin-slow' : ''} /> </button>
                <button onClick={handleMuteToggle} title="Mute/Unmute" className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-full text-xl flex items-center justify-center shadow flex-1 min-w-[60px] transition-all duration-150">
                  {muted ? <MdVolumeOff size={24} /> : <MdVolumeUp size={24} />}
                </button>
              </div>
            </div>
            <div className="flex justify-center mt-4">
              <button
                onClick={handleResync}
                className="bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2"
              >
                Resync 🔄
              </button>
            </div>
            <div className="flex justify-center mt-4 gap-4 flex-wrap">
              {audioWarning && (
                <div className="w-full text-center text-red-500 font-semibold mb-2">{audioWarning}</div>
              )}
              <button
                onClick={handleShareScreen}
                disabled={isSharing}
                className={`bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2 ${isSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSharing ? 'Sharing...' : 'Share Screen'}
              </button>
              {isSharing && (
                <button
                  onClick={handleStopShare}
                  className="bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2"
                >
                  Stop Sharing
                </button>
              )}
              <button
                onClick={handleStartCall}
                disabled={isCalling}
                className={`bg-gradient-to-br from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2 ${isCalling ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCalling ? 'In Call...' : 'Start Video Call'}
              </button>
              {isCalling && (
                <button
                  onClick={handleSwitchCamera}
                  className="bg-gradient-to-br from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2"
                >
                  Switch Camera
                </button>
              )}
              {isCalling && (
                <button
                  onClick={handleStopCall}
                  className="bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2"
                >
                  Stop Call
                </button>
              )}
              {isCalling && (
                <button
                  onClick={handleCallMuteToggle}
                  className={`bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2`}
                >
                  {isCallMuted ? <MdVolumeOff size={22} /> : <MdVolumeUp size={22} />}
                  {isCallMuted ? 'Unmute' : 'Mute'}
                </button>
              )}
              {isCalling && (
                <button
                  onClick={() => setIsMirrored(m => !m)}
                  className="bg-gradient-to-br from-purple-400 to-purple-600 hover:from-purple-500 hover:to-purple-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2"
                >
                  {isMirrored ? 'Unflip Camera' : 'Flip Camera'}
                </button>
              )}
              <button
                onClick={() => setShowTwilioCall(true)}
                className="bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-bold py-2 px-6 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2"
              >
                Start Twilio Call
              </button>
            </div>
            {(localVideoStream || remoteVideoStream) && (
              <div className="relative w-full h-[50vh] sm:h-[100vh] min-h-[320px] sm:min-h-[600px] max-h-[90vh] mt-4 rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-pink-100 to-blue-100">
                {/* Remote (other's) video: top half */}
                {remoteVideoStream && (
                  <video
                    className="absolute top-0 left-0 w-full h-1/2 object-cover border-b-2 border-blue-300"
                    style={{ height: '50%', minHeight: '160px', maxHeight: '45vh' }}
                    autoPlay
                    playsInline
                    ref={el => { if (el && remoteVideoStream) el.srcObject = remoteVideoStream; }}
                  />
                )}
                {/* Local (self) video: bottom half */}
                {localVideoStream && (
                  <video
                    className={`absolute left-0 w-full h-1/2 object-cover border-t-2 border-pink-300${isMirrored ? ' scale-x-[-1]' : ''}`}
                    style={{ top: '50%', height: '50%', minHeight: '160px', maxHeight: '45vh', transform: isMirrored ? 'scaleX(-1)' : undefined }}
                    autoPlay
                    playsInline
                    muted
                    ref={el => { if (el && localVideoStream) el.srcObject = localVideoStream; }}
                  />
                )}
                {/* Overlay labels */}
                {remoteVideoStream && (
                  <div className="absolute top-2 left-2 bg-blue-500/70 text-white text-xs px-2 py-1 rounded shadow">Partner</div>
                )}
                {localVideoStream && (
                  <div className="absolute left-2 bottom-2 bg-pink-500/70 text-white text-xs px-2 py-1 rounded shadow">You</div>
                )}
              </div>
            )}
            {/* Controls and mic selector below video area, minimal design, no pink border */}
            {isCalling && (
              <div className="w-full flex flex-col items-center justify-center gap-2 mb-4 mt-2">
                <div className="flex items-center justify-center gap-4">
                  <button onClick={handleCallMuteToggle} title={isCallMuted ? 'Unmute' : 'Mute'} className="p-2 rounded-full hover:bg-gray-100 transition-all">
                    {isCallMuted ? <MdMicOff size={24} className="text-blue-600" /> : <MdMic size={24} className="text-blue-600" />}
                  </button>
                  <button onClick={() => setIsMirrored(m => !m)} title={isMirrored ? 'Unflip Camera' : 'Flip Camera'} className="p-2 rounded-full hover:bg-gray-100 transition-all">
                    <MdFlipCameraAndroid size={24} className="text-purple-600" />
                  </button>
                  <button onClick={handleSwitchCamera} title="Switch Camera" className="p-2 rounded-full hover:bg-gray-100 transition-all">
                    <MdSwitchCamera size={24} className="text-yellow-600" />
                  </button>
                  <button onClick={handleStopCall} title="Stop Call" className="p-2 rounded-full hover:bg-gray-100 transition-all">
                    <MdCallEnd size={24} className="text-red-600" />
                  </button>
                </div>
                {audioDevices.length > 0 && (
                  <div className="flex flex-col items-center w-full mt-1">
                    <label className="text-xs text-gray-600 mb-1">Select Microphone:</label>
                    <select
                      className="border rounded px-2 py-1 text-sm w-48"
                      value={selectedAudioDeviceId}
                      onChange={e => setSelectedAudioDeviceId(e.target.value)}
                    >
                      {audioDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone (${device.deviceId})`}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <p className="mt-6 text-pink-600 text-center text-lg font-medium">Share a YouTube video and control it together in real time!</p>
      </div>
      
      {/* Twilio Video Call Modal */}
      <TwilioVideoCall 
        isActive={showTwilioCall} 
        onClose={() => setShowTwilioCall(false)} 
      />
    </div>
  );
};

export default WatchTogether; 