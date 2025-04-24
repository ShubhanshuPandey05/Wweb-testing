const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['free', 'basic', 'premium'],
    unique: true
  },
  price: {
    type: Number,
    required: true
  },
  messageQuota: {
    type: Number,
    required: true
  },
  fileUploadAllowed: {
    type: Boolean,
    default: false
  },
  features: [{
    type: String
  }],
  active: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Plan', PlanSchema); 