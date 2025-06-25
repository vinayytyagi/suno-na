# Suno Na Backend

Backend for the private music-sharing app between Muskan (M) and Vinay (V).

## Features

- 🔐 Secure authentication with JWT
- 🎵 Song upload and management (Muskan only)
- 📊 Real-time play tracking and listening status
- 🌐 Socket.IO for live updates
- ☁️ Cloudinary integration for audio storage
- 📈 Play count analytics

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   - Copy `env.example` to `.env`
   - Update the following variables:
     - `MONGODB_URI`: Your MongoDB connection string
     - `JWT_SECRET`: A secure secret key
     - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
     - `CLOUDINARY_API_KEY`: Your Cloudinary API key
     - `CLOUDINARY_API_SECRET`: Your Cloudinary API secret
     - `MUSKAN_PASSWORD`: Password for Muskan (M)
     - `VINAY_PASSWORD`: Password for Vinay (V)

3. **Initialize Users:**
   ```bash
   node initUsers.js
   ```

4. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with role and password
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/status` - Get user status

### Songs
- `POST /api/songs/upload` - Upload song (Muskan only)
- `GET /api/songs` - Get all songs
- `POST /api/songs/:songId/play` - Track song play
- `POST /api/songs/:songId/listening` - Update listening status
- `DELETE /api/songs/:songId` - Delete song (Muskan only)

## Socket.IO Events

- `userLogin` - User login notification
- `userStatusUpdate` - Online/offline status updates
- `vinayOnline` - Notification when Vinay comes online
- `nowPlaying` - Song playing status
- `stoppedPlaying` - Song stopped playing


## Technologies Used

- Node.js & Express
- MongoDB & Mongoose
- Socket.IO
- Cloudinary
- JWT Authentication
- bcryptjs for password hashing 