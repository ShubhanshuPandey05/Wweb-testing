const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    default: 'free'
  },
  whatsappConnected: {
    type: Boolean,
    default: false
  },
  whatsappSessionData: {
    type: String,
    default: null
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },
  messageQuota: {
    type: Number,
    default: 50 // Free tier quota
  },
  messagesUsed: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Generate API key for new users
    if (!this.apiKey) {
      this.apiKey = this._id + '-' + Math.random().toString(36).substring(2, 15);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password validity
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema); 