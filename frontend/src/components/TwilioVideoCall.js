import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { MdCallEnd, MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdSwitchCamera } from 'react-icons/md';

const TwilioVideoCall = ({ isActive, onClose }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [localParticipant, setLocalParticipant] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, connected, ended
  const [incomingCall, setIncomingCall] = useState(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const roomRef = useRef(null);

  // Initialize Twilio Video
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Twilio) {
      const script = document.createElement('script');
      script.src = 'https://sdk.twilio.com/js/video/releases/2.24.0/twilio-video.min.js';
      script.onload = () => {
        console.log('Twilio Video SDK loaded');
      };
      document.head.appendChild(script);
    }
  }, []);

  // Get Twilio token from backend
  const getTwilioToken = async (identity, roomName) => {
    try {
      const response = await fetch('/api/twilio-video/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity, roomName }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get Twilio token');
      }
      
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error getting Twilio token:', error);
      throw error;
    }
  };

  // Start Twilio video call
  const startTwilioCall = async () => {
    if (!window.Twilio || !socket) return;
    
    try {
      setIsConnecting(true);
      setError('');
      
      const roomName = `twilio-room-${Date.now()}`;
      const identity = `${user.role}-${Date.now()}`;
      
      // Get token from backend
      const token = await getTwilioToken(identity, roomName);
      
      // Connect to room
      const twilioRoom = await window.Twilio.Video.connect(token, {
        name: roomName,
        audio: true,
        video: true,
      });
      
      roomRef.current = twilioRoom;
      setRoom(twilioRoom);
      setLocalParticipant(twilioRoom.localParticipant);
      setCallStatus('connected');
      
      // Set up local video
      console.log('Local participant video tracks:', twilioRoom.localParticipant.videoTracks.size);
      if (localVideoRef.current) {
        twilioRoom.localParticipant.videoTracks.forEach(publication => {
          console.log('Local video track:', publication.isSubscribed ? 'subscribed' : 'not subscribed');
          if (publication.isSubscribed) {
            console.log('Attaching local video track to localVideoRef');
            publication.track.attach(localVideoRef.current);
          }
        });
      }
      
      // Handle participant connections
      twilioRoom.on('participantConnected', participant => {
        console.log('Participant connected:', participant.identity);
        setParticipants(prev => [...prev, participant]);
        
        // Set up remote video for new tracks
        participant.on('trackSubscribed', track => {
          console.log('Track subscribed:', track.kind, track.name);
          if (track.kind === 'video') {
            console.log('Setting remote video track');
            setRemoteVideoTrack(track);
            if (remoteVideoRef.current) {
              console.log('Attaching remote video track to remoteVideoRef');
              track.attach(remoteVideoRef.current);
            }
          }
        });
        
        // Handle existing tracks
        participant.videoTracks.forEach(publication => {
          if (publication.isSubscribed) {
            console.log('Found existing video track');
            setRemoteVideoTrack(publication.track);
            if (remoteVideoRef.current) {
              console.log('Attaching existing video track to remoteVideoRef');
              publication.track.attach(remoteVideoRef.current);
            }
          }
        });
      });
      
      twilioRoom.on('participantDisconnected', participant => {
        console.log('Participant disconnected:', participant.identity);
        setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
        setCallStatus('ended');
      });
      
      // Notify partner about the call
      socket.emit('twilioVideoCallRequest', { roomName, identity });
      
    } catch (error) {
      console.error('Error starting Twilio call:', error);
      setError('Failed to start video call: ' + error.message);
      setCallStatus('idle');
    } finally {
      setIsConnecting(false);
    }
  };

  // Join existing Twilio call
  const joinTwilioCall = async (roomName, identity) => {
    if (!window.Twilio || !socket) return;
    
    try {
      setIsConnecting(true);
      setError('');
      
      // Get token from backend
      const token = await getTwilioToken(identity, roomName);
      
      // Connect to room
      const twilioRoom = await window.Twilio.Video.connect(token, {
        name: roomName,
        audio: true,
        video: true,
      });
      
      roomRef.current = twilioRoom;
      setRoom(twilioRoom);
      setLocalParticipant(twilioRoom.localParticipant);
      setCallStatus('connected');
      
      // Set up local video
      console.log('Local participant video tracks (join):', twilioRoom.localParticipant.videoTracks.size);
      if (localVideoRef.current) {
        twilioRoom.localParticipant.videoTracks.forEach(publication => {
          console.log('Local video track (join):', publication.isSubscribed ? 'subscribed' : 'not subscribed');
          if (publication.isSubscribed) {
            console.log('Attaching local video track to localVideoRef (join)');
            publication.track.attach(localVideoRef.current);
          }
        });
      }
      
      // Handle existing participants
      twilioRoom.participants.forEach(participant => {
        if (participant.identity !== twilioRoom.localParticipant.identity) {
          console.log('Existing participant:', participant.identity);
          setParticipants(prev => [...prev, participant]);
          // Set up remote video for new tracks
          participant.on('trackSubscribed', track => {
            if (track.kind === 'video') {
              setRemoteVideoTrack(track);
              if (remoteVideoRef.current) {
                track.attach(remoteVideoRef.current);
              }
            }
          });
          // Handle existing tracks
          participant.videoTracks.forEach(publication => {
            if (publication.isSubscribed) {
              setRemoteVideoTrack(publication.track);
              if (remoteVideoRef.current) {
                publication.track.attach(remoteVideoRef.current);
              }
            }
          });
        }
      });
      
      // Handle new participant connections
      twilioRoom.on('participantConnected', participant => {
        if (participant.identity !== twilioRoom.localParticipant.identity) {
          setParticipants(prev => [...prev, participant]);
          participant.on('trackSubscribed', track => {
            if (track.kind === 'video') {
              setRemoteVideoTrack(track);
              if (remoteVideoRef.current) {
                track.attach(remoteVideoRef.current);
              }
            }
          });
          participant.videoTracks.forEach(publication => {
            if (publication.isSubscribed) {
              setRemoteVideoTrack(publication.track);
              if (remoteVideoRef.current) {
                publication.track.attach(remoteVideoRef.current);
              }
            }
          });
        }
      });
      
      twilioRoom.on('participantDisconnected', participant => {
        console.log('Participant disconnected:', participant.identity);
        setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
        setCallStatus('ended');
      });
      
    } catch (error) {
      console.error('Error joining Twilio call:', error);
      setError('Failed to join video call: ' + error.message);
      setCallStatus('idle');
    } finally {
      setIsConnecting(false);
    }
  };

  // End Twilio call
  const endTwilioCall = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setRoom(null);
    setParticipants([]);
    setLocalParticipant(null);
    setRemoteVideoTrack(null);
    setCallStatus('idle');
    setIncomingCall(null);
    onClose();
  };

  // Toggle mute
  const toggleMute = () => {
    if (localParticipant) {
      localParticipant.audioTracks.forEach(publication => {
        if (publication.isSubscribed) {
          publication.track.disable();
        }
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localParticipant) {
      localParticipant.videoTracks.forEach(publication => {
        if (publication.isSubscribed) {
          if (isVideoEnabled) {
            publication.track.disable();
          } else {
            publication.track.enable();
          }
        }
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Handle incoming call
  const handleIncomingCall = (callData) => {
    setIncomingCall(callData);
  };

  // Accept incoming call
  const acceptIncomingCall = () => {
    if (incomingCall) {
      joinTwilioCall(incomingCall.roomName, `${user.role}-${Date.now()}`);
      socket.emit('twilioVideoCallAccept', incomingCall);
      setIncomingCall(null);
    }
  };

  // Reject incoming call
  const rejectIncomingCall = () => {
    if (incomingCall) {
      socket.emit('twilioVideoCallReject', incomingCall);
      setIncomingCall(null);
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('twilioVideoCallRequest', handleIncomingCall);
    socket.on('twilioVideoCallAccept', () => {
      console.log('Partner accepted the call');
    });
    socket.on('twilioVideoCallReject', () => {
      console.log('Partner rejected the call');
      setCallStatus('idle');
      setError('Call was rejected by partner');
    });
    socket.on('twilioVideoCallEnd', () => {
      console.log('Partner ended the call');
      endTwilioCall();
    });

    return () => {
      socket.off('twilioVideoCallRequest');
      socket.off('twilioVideoCallAccept');
      socket.off('twilioVideoCallReject');
      socket.off('twilioVideoCallEnd');
    };
  }, [socket]);

  // Handle remote video track changes
  useEffect(() => {
    if (remoteVideoTrack && remoteVideoRef.current) {
      console.log('Attaching remote video track to element');
      remoteVideoTrack.attach(remoteVideoRef.current);
    }
  }, [remoteVideoTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Twilio Video Call</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Incoming Call */}
        {incomingCall && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
            <span>Incoming Twilio video call from {incomingCall.identity}</span>
            <div className="flex gap-2">
              <button
                onClick={acceptIncomingCall}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Accept
              </button>
              <button
                onClick={rejectIncomingCall}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Video Area */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4" style={{ height: '400px' }}>
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
          />
          <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
            Remote Video ({participants.length} participants) {remoteVideoTrack ? '✅' : '❌'}
          </div>
          
          {/* Local Video */}
          <video
            ref={localVideoRef}
            className="absolute bottom-4 right-4 w-32 h-24 object-cover rounded-lg border-2 border-white"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute bottom-4 right-4 bg-green-500 text-white px-2 py-1 rounded text-xs">
            Local Video
          </div>
          
          {/* Debug Info */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            Local: {localParticipant ? '✅' : '❌'} | Remote: {remoteVideoTrack ? '✅' : '❌'}
          </div>
          
          {/* Call Status */}
          {callStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white text-xl">Connecting...</div>
            </div>
          )}
          
          {callStatus === 'ended' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white text-xl">Call ended</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          {callStatus === 'idle' && (
            <button
              onClick={startTwilioCall}
              disabled={isConnecting}
              className="bg-green-500 text-white px-6 py-3 rounded-full hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {isConnecting ? 'Starting...' : 'Start Twilio Call'}
            </button>
          )}
          
          {callStatus === 'connected' && (
            <>
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'}`}
              >
                {isMuted ? <MdMicOff size={24} /> : <MdMic size={24} />}
              </button>
              
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full ${!isVideoEnabled ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'}`}
              >
                {!isVideoEnabled ? <MdVideocamOff size={24} /> : <MdVideocam size={24} />}
              </button>
              
              <button
                onClick={endTwilioCall}
                className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600"
              >
                <MdCallEnd size={24} />
              </button>
            </>
          )}
        </div>

        {/* Call Info */}
        {callStatus === 'connected' && (
          <div className="mt-4 text-center text-gray-600">
            <p>Connected to: {room?.name}</p>
            <p>Participants: {participants.length + 1}</p>
            <p>Debug: {participants.length} remote participants</p>
            {participants.map((p, i) => (
              <p key={i} className="text-xs">Participant {i + 1}: {p.identity} (Video tracks: {p.videoTracks.size})</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TwilioVideoCall; 