# Twilio Video Call Setup Guide

This guide will help you set up Twilio video calls for the Suno Na app.

## Prerequisites

1. A Twilio account (sign up at https://www.twilio.com)
2. Node.js and npm installed
3. The backend server running

## Step 1: Get Twilio Credentials

1. Log in to your Twilio Console
2. Go to the Dashboard and note your **Account SID** and **Auth Token**
3. Go to **API Keys & Tokens** → **API Keys**
4. Create a new API Key and note the **API Key SID** and **API Key Secret**

## Step 2: Configure Environment Variables

1. Copy the `.env.example` file to `.env` in the backend directory
2. Add your Twilio credentials:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_API_KEY=your_twilio_api_key_here
TWILIO_API_SECRET=your_twilio_api_secret_here
```

## Step 3: Install Dependencies

```bash
cd backend
npm install
```

## Step 4: Test the Setup

1. Start the backend server:
```bash
npm run dev
```

2. Test the Twilio health endpoint:
```bash
curl http://localhost:5000/api/twilio-video/health
```

You should see:
```json
{
  "status": "configured",
  "message": "Twilio service is ready"
}
```

## Step 5: Using Twilio Video Calls

1. Open the WatchTogether page in your app
2. Click the "Start Twilio Call" button
3. The Twilio video call interface will open
4. Your partner will receive an incoming call notification
5. Both users can join the same video room

## Features

- **High-quality video calls** using Twilio's infrastructure
- **Automatic room creation** and management
- **Incoming call notifications** with accept/reject options
- **Mute/unmute** and **video on/off** controls
- **Real-time participant management**
- **Works alongside existing WebRTC calls**

## Troubleshooting

### "Twilio credentials not configured" error
- Make sure all environment variables are set correctly
- Restart the backend server after changing environment variables

### "Failed to get Twilio token" error
- Check your Twilio credentials
- Ensure your Twilio account has video calling enabled
- Verify your account has sufficient credits

### Video not showing
- Check browser permissions for camera and microphone
- Ensure HTTPS is used in production (required for media access)
- Try refreshing the page and allowing permissions again

## Cost Considerations

- Twilio video calls are charged per participant-minute
- Check Twilio's pricing page for current rates
- Consider setting up usage limits in your Twilio console

## Security Notes

- Never commit your Twilio credentials to version control
- Use environment variables for all sensitive data
- Consider implementing user authentication before allowing video calls
- Set up proper CORS configuration for production 