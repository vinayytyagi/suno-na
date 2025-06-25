const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { role, password } = req.body;

    // Validate input
    if (!role || !password) {
      return res.status(400).json({ message: 'Role and password are required' });
    }

    if (!['M', 'V'].includes(role)) {
      return res.status(400).json({ message: 'Role must be either M or V' });
    }

    // Find user by role
    const user = await User.findOne({ role });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT token with longer expiration (7 days)
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        role: user.role,
        isOnline: user.isOnline
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout route
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId);
      
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        await user.save();
      }

      res.json({ message: 'Logout successful' });
    } catch (jwtError) {
      console.error('JWT verification failed during logout:', jwtError.message);
      // Even if JWT is invalid, we consider logout successful
      res.json({ message: 'Logout successful' });
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user status
router.get('/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        role: user.role,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      });
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      } else {
        return res.status(401).json({ message: 'Token verification failed' });
      }
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user location (Muskan only)
router.post('/users/location', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'M') {
      return res.status(403).json({ message: 'Only Muskan can update her location' });
    }
    const { lat, lng, timestamp } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof timestamp !== 'number') {
      return res.status(400).json({ message: 'Invalid location data' });
    }
    user.location = { lat, lng, timestamp };
    await user.save();
    res.json({ message: 'Location updated' });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Muskan's latest location (for Vinay)
router.get('/users/muskan-location', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'V') {
      return res.status(403).json({ message: 'Only Vinay can fetch Muskan\'s location' });
    }
    const muskan = await User.findOne({ role: 'M' });
    if (!muskan || !muskan.location) {
      return res.status(404).json({ message: 'Muskan\'s location not found' });
    }
    res.json({ location: muskan.location });
  } catch (error) {
    console.error('Get Muskan location error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 