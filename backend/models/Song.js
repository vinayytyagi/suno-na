const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in seconds
    required: true
  },
  cloudinaryUrl: {
    type: String,
    required: true
  },
  cloudinaryPublicId: {
    type: String,
    required: true
  },
  uploadTime: {
    type: Date,
    default: Date.now
  },
  uploadIndex: {
    type: Number,
    required: true,
    unique: true
  },
  playCounts: {
    M: { type: Number, default: 0 },
    V: { type: Number, default: 0 }
  },
  currentlyListening: {
    type: String,
    enum: ['M', 'V', null],
    default: null
  },
  totalPlays: {
    type: Number,
    default: 0
  },
  totalPlayTime: {
    type: Number,
    default: 0
  },
  comments: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      user: { type: String, enum: ['M', 'V'], required: true },
      text: { type: String },
      audioUrl: { type: String },
      audioPublicId: { type: String },
      createdAt: { type: Date, default: Date.now }
    }
  ]
}, {
  timestamps: true
});

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Method to increment play count
songSchema.methods.incrementPlayCount = function(userRole) {
  this.playCounts[userRole]++;
  this.totalPlays++;
  return this.save();
};

// Method to set listening status
songSchema.methods.setListeningStatus = function(userRole) {
  this.currentlyListening = userRole;
  return this.save();
};

// Method to clear listening status
songSchema.methods.clearListeningStatus = function() {
  this.currentlyListening = null;
  return this.save();
};

module.exports = mongoose.model('Song', songSchema); 