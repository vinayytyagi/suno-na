const twilio = require('twilio');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;

if (!accountSid || !authToken || !apiKey || !apiSecret) {
  console.warn('Twilio credentials not found. Video calls will not work.');
}

let client = null;
let apiKeySid = null;
let apiSecretValue = null;

try {
  if (accountSid && authToken && apiKey && apiSecret) {
    client = twilio(accountSid, authToken);
    apiKeySid = apiKey;
    apiSecretValue = apiSecret;
  }
} catch (error) {
  console.warn('Failed to initialize Twilio client:', error.message);
}

// Generate access token for video calls
const generateVideoToken = (identity, roomName) => {
  if (!apiKeySid || !apiSecretValue || !accountSid) {
    throw new Error('Twilio credentials not configured');
  }

  // Debug: Log credential info (remove in production)
  console.log('Creating token with:', {
    accountSid: accountSid ? `${accountSid.substring(0, 10)}...` : 'missing',
    apiKeySid: apiKeySid ? `${apiKeySid.substring(0, 10)}...` : 'missing',
    apiSecret: apiSecretValue ? 'present' : 'missing',
    identity,
    roomName
  });

  // Create access token with identity
  const accessToken = new twilio.jwt.AccessToken(accountSid, apiKeySid, apiSecretValue, {
    identity: identity
  });

  // Create Video grant
  const videoGrant = new twilio.jwt.AccessToken.VideoGrant({
    room: roomName,
  });

  // Add grant to token
  accessToken.addGrant(videoGrant);

  // Generate token
  return accessToken.toJwt();
};

// Create a video room
const createVideoRoom = async (roomName, maxParticipants = 2) => {
  if (!client) {
    throw new Error('Twilio client not configured');
  }

  try {
    const room = await client.video.v1.rooms.create({
      uniqueName: roomName,
      maxParticipants,
      type: 'group'
    });
    return room;
  } catch (error) {
    // If room already exists, return it
    if (error.code === 53113) {
      return await client.video.v1.rooms(roomName).fetch();
    }
    throw error;
  }
};

// Get room participants
const getRoomParticipants = async (roomName) => {
  if (!client) {
    throw new Error('Twilio client not configured');
  }

  try {
    const participants = await client.video.v1.rooms(roomName)
      .participants
      .list();
    return participants;
  } catch (error) {
    console.error('Error getting room participants:', error);
    return [];
  }
};

// Disconnect participant from room
const disconnectParticipant = async (roomName, participantSid) => {
  if (!client) {
    throw new Error('Twilio client not configured');
  }

  try {
    await client.video.v1.rooms(roomName)
      .participants(participantSid)
      .update({ status: 'disconnected' });
    return true;
  } catch (error) {
    console.error('Error disconnecting participant:', error);
    return false;
  }
};

module.exports = {
  generateVideoToken,
  createVideoRoom,
  getRoomParticipants,
  disconnectParticipant
}; 