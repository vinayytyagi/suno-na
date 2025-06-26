const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function initializeUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suno-na');
    console.log('Connected to MongoDB');

    // Check if users already exist
    const existingUsers = await User.find();
    if (existingUsers.length > 0) {
      console.log('Users already exist in database');
      process.exit(0);
    }

    // Create Muskan (M)
    const muskan = new User({
      role: 'M',
      password: 'smileyy'
    });
    await muskan.save();
    console.log('Muskan (M) user created');

    // Create Vinay (V)
    const vinay = new User({
      role: 'V',
      password: 'vinayy'
    });
    await vinay.save();
    console.log('Vinay (V) user created');

    console.log('Users initialized successfully!');
    console.log('Default passwords:');
    console.log('Muskan (M): smileyy');
    console.log('Vinay (V): vinayy');

  } catch (error) {
    console.error('Error initializing users:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

initializeUsers(); 