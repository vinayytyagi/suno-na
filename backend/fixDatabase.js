const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/suno-na';
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully!');

    // Get the database connection
    const db = mongoose.connection.db;
    
    // Check existing indexes
    console.log('\n📋 Checking existing indexes...');
    const indexes = await db.collection('users').indexes();
    console.log('Current indexes:', indexes.map(idx => idx.name));

    // Drop the problematic username index if it exists
    const usernameIndex = indexes.find(idx => idx.key && idx.key.username);
    if (usernameIndex) {
      console.log('🗑️ Dropping problematic username index...');
      await db.collection('users').dropIndex(usernameIndex.name);
      console.log('✅ Username index dropped successfully');
    }

    // Drop all existing users to start fresh
    console.log('\n🗑️ Dropping all existing users...');
    await db.collection('users').deleteMany({});
    console.log('✅ All users deleted');

    // Define User schema without username field
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

    // Create Muskan (M)
    console.log('\n👤 Creating Muskan user...');
    const muskan = new User({
      role: 'M',
      password: process.env.MUSKAN_PASSWORD || 'smileyy'
    });
    await muskan.save();
    console.log('✅ Muskan (M) user created successfully');

    // Create Vinay (V)
    console.log('👤 Creating Vinay user...');
    const vinay = new User({
      role: 'V',
      password: process.env.VINAY_PASSWORD || 'vinayy'
    });
    await vinay.save();
    console.log('✅ Vinay (V) user created successfully');

    // Verify users were created
    const allUsers = await User.find();
    console.log(`\n📊 Total users in database: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`   - ${user.role} (${user.role === 'M' ? 'Muskan' : 'Vinay'})`);
    });

    console.log('\n🎉 Database fixed successfully!');
    console.log('📝 Login credentials:');
    console.log('   Muskan (M):', process.env.MUSKAN_PASSWORD || 'smileyy');
    console.log('   Vinay (V):', process.env.VINAY_PASSWORD || 'vinayy');

  } catch (error) {
    console.error('❌ Error fixing database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixDatabase(); 