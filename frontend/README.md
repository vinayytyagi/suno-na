# Suno Na Frontend

Frontend for the private music-sharing app between Muskan (M) and Vinay (V).

## Features

- 🎨 Beautiful, romantic UI with TailwindCSS
- 🔐 Secure authentication with role-based access
- 🎵 Drag & drop song upload (Muskan only)
- 🎧 Real-time audio player with play tracking
- 📊 Live listening status and play counts
- 🌐 Real-time online status updates
- 📱 Responsive design

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Components

### Core Components
- `Login` - Authentication with role selection
- `Dashboard` - Main application interface
- `Header` - Navigation and user status
- `UploadSong` - Song upload interface (Muskan only)
- `SongList` - Display and play songs

### Contexts
- `AuthContext` - User authentication and JWT management
- `SocketContext` - Real-time communication with Socket.IO

## Features by Role

### Muskan (M) - Sender
- Upload songs with drag & drop
- View Vinay's online status
- Delete songs
- See play counts for both users
- Real-time notifications when Vinay comes online

### Vinay (V) - Listener
- Listen to uploaded songs
- View play counts
- Real-time listening status updates

## Technologies Used

- React 18
- TailwindCSS
- Socket.IO Client
- Axios for API calls
- React Router for navigation
- Heroicons for icons

## API Integration

The frontend connects to the backend API at `http://localhost:5000` and expects the following endpoints:

- Authentication: `/api/auth/*`
- Songs: `/api/songs/*`
- Socket.IO for real-time updates

## Styling

The app uses a custom TailwindCSS configuration with:
- Primary colors (pink/purple gradient)
- Romantic colors (orange/warm gradient)
- Custom fonts (Inter, Playfair Display)
- Smooth animations and transitions

## Real-time Features

- Live online/offline status
- Real-time "now playing" indicators
- Instant play count updates
- Socket.IO event handling
