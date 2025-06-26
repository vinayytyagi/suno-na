const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Define User schema inline to avoid import issues
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

async function addUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/suno-na';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully!');

    // Check if users already exist
    const existingUsers = await User.find();
    console.log(`Found ${existingUsers.length} existing users`);

    if (existingUsers.length > 0) {
      console.log('Users already exist. Deleting existing users...');
      await User.deleteMany({});
      console.log('Existing users deleted.');
    }

    // Create Muskan (M)
    console.log('Creating Muskan user...');
    const muskan = new User({
      role: 'M',
      password: process.env.MUSKAN_PASSWORD || 'smileyy'
    });
    await muskan.save();
    console.log('✅ Muskan (M) user created successfully');

    // Create Vinay (V)
    console.log('Creating Vinay user...');
    const vinay = new User({
      role: 'V',
      password: process.env.VINAY_PASSWORD || 'vinayy'
    });
    await vinay.save();
    console.log('✅ Vinay (V) user created successfully');

    console.log('\n🎉 Users added successfully!');
    console.log('📝 Login credentials:');
    console.log('   Muskan (M):', process.env.MUSKAN_PASSWORD || 'smileyy');
    console.log('   Vinay (V):', process.env.VINAY_PASSWORD || 'vinayy');

    // Verify users were created
    const allUsers = await User.find();
    console.log(`\n📊 Total users in database: ${allUsers.length}`);

  } catch (error) {
    console.error('❌ Error adding users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

addUsers(); 