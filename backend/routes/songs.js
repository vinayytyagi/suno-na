const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const jwt = require('jsonwebtoken');
const Song = require('../models/Song');
const router = express.Router();
const { getAudioDurationInSeconds } = require('get-audio-duration');
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

// Middleware to check if user is Muskan (M)
const requireMuskan = (req, res, next) => {
  if (req.user.role !== 'M') {
    return res.status(403).json({ message: 'Only Muskan can perform this action' });
  }
  next();
};

// Upload song (only for Muskan)
router.post('/upload', authenticateToken, requireMuskan, upload.single('song'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Save the uploaded file temporarily
    const tempFilePath = path.join(__dirname, '..', 'temp', `${Date.now()}-${req.file.originalname}`);
    fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Get real audio duration
    let duration = 180;
    try {
      duration = Math.round(await getAudioDurationInSeconds(tempFilePath));
    } catch (err) {
      console.error('Error getting audio duration:', err);
    }

    // Convert buffer to base64
    const fileBuffer = req.file.buffer;
    const base64File = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;

    // Upload to Cloudinary with raw resource type
    const uploadResult = await cloudinary.uploader.upload(base64File, {
      resource_type: 'raw',
      folder: 'suno-na-songs',
      format: 'mp3',
      quality: 'auto:best'
    });

    // Delete the temp file
    fs.unlinkSync(tempFilePath);

    // Find the current max uploadIndex
    const lastSong = await Song.findOne().sort({ uploadIndex: -1 });
    const nextIndex = lastSong ? lastSong.uploadIndex + 1 : 1;

    // Create song record
    const song = new Song({
      title,
      duration,
      cloudinaryUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id,
      uploadIndex: nextIndex
    });

    await song.save();

    res.status(201).json({
      message: 'Song uploaded successfully',
      song: {
        id: song._id,
        title: song.title,
        duration: song.formattedDuration,
        uploadTime: song.uploadTime,
        uploadIndex: song.uploadIndex
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

// Get all songs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const songs = await Song.find().sort({ uploadTime: -1 });
    
    const songsWithFormattedData = songs.map(song => ({
      id: song._id,
      title: song.title,
      duration: song.formattedDuration,
      uploadTime: song.uploadTime,
      cloudinaryUrl: song.cloudinaryUrl,
      playCounts: song.playCounts,
      totalPlays: song.totalPlays,
      currentlyListening: song.currentlyListening,
      uploadIndex: song.uploadIndex
    }));

    res.json(songsWithFormattedData);
  } catch (error) {
    console.error('Get songs error:', error);
    res.status(500).json({ message: 'Failed to fetch songs' });
  }
});

// Track song play
router.post('/:songId/play', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params;
    const userRole = req.user.role;

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Increment play count
    await song.incrementPlayCount(userRole);
    // Add to play history
    song.playHistory.push({ user: userRole, playedAt: new Date() });
    await song.save();

    res.json({
      message: 'Play count updated',
      playCounts: song.playCounts,
      totalPlays: song.totalPlays
    });

  } catch (error) {
    console.error('Play tracking error:', error);
    res.status(500).json({ message: 'Failed to track play' });
  }
});

// Get play history for a song
router.get('/:songId/play-history', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params;
    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }
    // Sort by playedAt descending (most recent first)
    const history = [...(song.playHistory || [])].sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch play history', error: error.message });
  }
});

// Set listening status
router.post('/:songId/listening', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params;
    const { userRole } = req.user;
    const { isListening, secondsListened } = req.body;

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    if (isListening) {
      await song.setListeningStatus(userRole);
    } else {
      await song.clearListeningStatus();
      if (typeof secondsListened === 'number' && secondsListened > 0) {
        song.totalPlayTime += Math.round(secondsListened);
        await song.save();
      }
    }

    res.json({
      message: 'Listening status updated',
      currentlyListening: song.currentlyListening
    });

  } catch (error) {
    console.error('Listening status error:', error);
    res.status(500).json({ message: 'Failed to update listening status' });
  }
});

// Delete song (only for Muskan)
router.delete('/:songId', authenticateToken, requireMuskan, async (req, res) => {
  try {
    const { songId } = req.params;

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(song.cloudinaryPublicId, {
      resource_type: 'raw'
    });

    // Delete from database
    await Song.findByIdAndDelete(songId);

    res.json({ message: 'Song deleted successfully' });

  } catch (error) {
    console.error('Delete song error:', error);
    res.status(500).json({ message: 'Failed to delete song' });
  }
});

// --- COMMENTS ENDPOINTS ---
// Add a comment to a song
router.post('/:songId/comments', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params;
    const { text } = req.body;
    const user = req.user.role;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text required' });
    }
    const song = await Song.findById(songId);
    if (!song) return res.status(404).json({ message: 'Song not found' });
    const comment = { user, text: text.trim() };
    song.comments.push(comment);
    await song.save();
    // Return the last comment (with _id and createdAt)
    res.status(201).json(song.comments[song.comments.length - 1]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment', error: error.message });
  }
});

// Get all comments for a song
router.get('/:songId/comments', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params;
    const song = await Song.findById(songId);
    if (!song) return res.status(404).json({ message: 'Song not found' });
    // Sort by createdAt ascending
    const comments = [...song.comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch comments', error: error.message });
  }
});

// Delete a comment (only by the user who posted it)
router.delete('/:songId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { songId, commentId } = req.params;
    const user = req.user.role;
    const song = await Song.findById(songId);
    if (!song) return res.status(404).json({ message: 'Song not found' });
    const comment = song.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.user !== user) return res.status(403).json({ message: 'You can only delete your own comments' });
    comment.remove();
    await song.save();
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete comment', error: error.message });
  }
});

// Add a comment to a song (audio)
router.post('/:songId/comments/audio', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    const { songId } = req.params;
    const user = req.user.role;
    const text = req.body.text;
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }
    // Upload to Cloudinary
    const fileBuffer = req.file.buffer;
    const base64File = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
    const uploadResult = await cloudinary.uploader.upload(base64File, {
      resource_type: 'raw',
      folder: 'suno-na-comments',
      format: 'mp3',
      quality: 'auto:best'
    });
    // Add comment to song
    const song = await Song.findById(songId);
    if (!song) return res.status(404).json({ message: 'Song not found' });
    const comment = {
      user,
      text: text || '',
      audioUrl: uploadResult.secure_url,
      audioPublicId: uploadResult.public_id
    };
    song.comments.push(comment);
    await song.save();
    res.status(201).json(song.comments[song.comments.length - 1]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add audio comment', error: error.message });
  }
});

module.exports = router; 