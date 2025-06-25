# Suno Na - Private Music Sharing App

A beautiful, private music-sharing application designed specifically for Muskan (M) and Vinay (V). This full-stack web app allows Muskan to upload and share high-quality music with Vinay, featuring real-time listening status, play tracking, and a romantic, intimate user experience.

## 🌟 Features

### 🔐 Authentication
- Simple role-based login (M for Muskan, V for Vinay)
- Secure JWT authentication
- Password protection stored in environment variables

### 🎵 Music Management
- **Muskan (Sender)**: Upload high-quality MP3/WAV files
- **Vinay (Listener)**: Listen to uploaded songs
- Cloudinary integration with raw mode (no compression)
- Drag & drop file upload interface

### 📊 Real-time Features
- Live online/offline status indicators
- Real-time "now playing" status
- Instant play count updates
- Socket.IO for seamless real-time communication

### 🎨 Beautiful UI
- Romantic, soft design with TailwindCSS
- Custom color schemes (pink/purple for Muskan, orange/warm for Vinay)
- Responsive design for all devices
- Smooth animations and transitions

### 📈 Analytics
- Individual play counts for both users
- Total play statistics
- Upload timestamps and duration tracking

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.IO** for real-time communication
- **Cloudinary** for audio storage
- **JWT** for authentication
- **bcryptjs** for password hashing

### Frontend
- **React 18** with functional components
- **TailwindCSS** for styling
- **Socket.IO Client** for real-time updates
- **Axios** for API communication
- **React Router** for navigation
- **Heroicons** for beautiful icons

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Cloudinary account
- npm or yarn

### 1. Clone and Setup
```bash
git clone <repository-url>
cd suno-na
```

### 2. Backend Setup
```bash
cd backend
npm install

# Copy environment file
cp env.example .env

# Edit .env with your configuration
# - MongoDB URI
# - Cloudinary credentials
# - JWT secret
# - User passwords
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

### 4. Initialize Database
```bash
cd ../backend
node initUsers.js
```

### 5. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### 6. Access the App
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔧 Configuration

### Environment Variables (.env)

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/suno-na

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# User Passwords
MUSKAN_PASSWORD=muskan123
VINAY_PASSWORD=vinay123
```

## 👥 User Roles

### Muskan (M) - Sender
- **Login**: Role "M" with password
- **Permissions**: Upload, delete songs, view Vinay's status
- **Features**: 
  - Drag & drop song upload
  - Real-time Vinay online status
  - Delete songs
  - View detailed play analytics

### Vinay (V) - Listener
- **Login**: Role "V" with password
- **Permissions**: Listen to songs, view play counts
- **Features**:
  - Listen to uploaded songs
  - View play statistics
  - Real-time listening status

## 🎵 Audio Features

- **Supported Formats**: MP3, WAV, and other audio formats
- **Quality**: High-quality uploads (320kbps MP3/WAV)
- **Storage**: Cloudinary with raw mode (no compression)
- **Player**: HTML5 audio player with custom controls
- **Real-time**: Live play tracking and status updates

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Role-based access control
- Secure file upload validation
- Environment variable protection
- CORS configuration

## 📱 Real-time Features

### Socket.IO Events
- `userLogin` - User connection notification
- `userStatusUpdate` - Online/offline status
- `vinayOnline` - Special notification for Muskan
- `nowPlaying` - Song playing status
- `stoppedPlaying` - Song stopped status

### Live Updates
- Real-time online status indicators
- Instant play count updates
- Live "now playing" badges
- Immediate song list updates

## 🎨 Design Philosophy

The app features a romantic, intimate design with:
- **Soft gradients** and warm colors
- **Custom typography** (Inter + Playfair Display)
- **Smooth animations** and transitions
- **Responsive layout** for all devices
- **Intuitive UX** with clear role separation

## 📁 Project Structure

```
suno-na/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   └── Song.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── songs.js
│   ├── server.js
│   ├── initUsers.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Header.js
│   │   │   ├── UploadSong.js
│   │   │   └── SongList.js
│   │   ├── contexts/
│   │   │   ├── AuthContext.js
│   │   │   └── SocketContext.js
│   │   └── App.js
│   └── package.json
└── README.md
```

## 🚀 Deployment

### Backend Deployment
1. Set up MongoDB (Atlas or local)
2. Configure Cloudinary account
3. Set environment variables
4. Deploy to Heroku, Vercel, or your preferred platform

### Frontend Deployment
1. Update API endpoints in production
2. Build the application: `npm run build`
3. Deploy to Netlify, Vercel, or your preferred platform

## 🤝 Contributing

This is a private project, but if you have suggestions or improvements, feel free to reach out!

## 📄 License

This project is private and intended for personal use by Muskan and Vinay.

## 💕 Special Thanks

Built with love for a special connection between two hearts through the universal language of music.

---

**Suno Na** - Where music brings hearts together 💕 