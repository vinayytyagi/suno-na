const express = require('express');
const router = express.Router();
const { generateVideoToken, createVideoRoom, getRoomParticipants } = require('../services/twilioService');

// Generate access token for video call
router.post('/token', async (req, res) => {
  try {
    const { identity, roomName } = req.body;
    
    if (!identity || !roomName) {
      return res.status(400).json({ 
        error: 'Identity and roomName are required' 
      });
    }

    // Create or get the room
    await createVideoRoom(roomName);
    
    // Generate token
    const token = generateVideoToken(identity, roomName);
    
    res.json({ 
      token,
      roomName,
      identity 
    });
  } catch (error) {
    console.error('Error generating video token:', error);
    res.status(500).json({ 
      error: 'Failed to generate video token',
      details: error.message 
    });
  }
});

// Get room participants
router.get('/room/:roomName/participants', async (req, res) => {
  try {
    const { roomName } = req.params;
    const participants = await getRoomParticipants(roomName);
    
    res.json({ 
      participants: participants.map(p => ({
        sid: p.sid,
        identity: p.identity,
        status: p.status
      }))
    });
  } catch (error) {
    console.error('Error getting room participants:', error);
    res.status(500).json({ 
      error: 'Failed to get room participants',
      details: error.message 
    });
  }
});

// Health check for Twilio service
router.get('/health', (req, res) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  
  const isConfigured = !!(accountSid && authToken && apiKey && apiSecret);
  
  res.json({ 
    status: isConfigured ? 'configured' : 'not_configured',
    message: isConfigured ? 'Twilio service is ready' : 'Twilio credentials not configured',
    credentials: {
      accountSid: accountSid ? `${accountSid.substring(0, 10)}...` : 'missing',
      authToken: authToken ? 'present' : 'missing',
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'missing',
      apiSecret: apiSecret ? 'present' : 'missing'
    }
  });
});

module.exports = router; 