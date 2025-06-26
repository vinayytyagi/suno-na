const mongoose = require('mongoose');
require('dotenv').config();

// Define User schema inline
const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['M', 'V'],
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    timestamp: { type: Number }
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

async function testConnection() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/suno-na';
    console.log('🔗 Testing MongoDB connection...');
    console.log('URI:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully!');

    // Check if users exist
    const users = await User.find();
    console.log(`\n👥 Found ${users.length} users in database:`);
    
    if (users.length === 0) {
      console.log('❌ No users found! You need to run addUsers.js first.');
    } else {
      users.forEach(user => {
        console.log(`   - ${user.role} (${user.role === 'M' ? 'Muskan' : 'Vinay'}) - Created: ${user.createdAt}`);
      });
    }

    // Test database operations
    console.log('\n🧪 Testing database operations...');
    const testUser = await User.findOne({ role: 'M' });
    if (testUser) {
      console.log('✅ Can read from database');
    } else {
      console.log('❌ Cannot read from database');
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    if (error.message.includes('IP whitelist')) {
      console.log('\n💡 IP Whitelist Issue:');
      console.log('   - Go to MongoDB Atlas dashboard');
      console.log('   - Add your current IP to the whitelist');
      console.log('   - Or add 0.0.0.0/0 to allow all IPs (for development)');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testConnection(); 