const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Plan = require('./models/Plan');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Plans data
const plansData = [
  {
    name: 'free',
    price: 0,
    messageQuota: 50,
    fileUploadAllowed: false,
    features: [
      'Send up to 50 messages per month',
      'Web dashboard access',
      'API access',
      'Text-only messages'
    ],
    active: true
  },
  {
    name: 'basic',
    price: 9.99,
    messageQuota: 500,
    fileUploadAllowed: true,
    features: [
      'Send up to 500 messages per month',
      'Web dashboard access',
      'API access',
      'Send files (images, documents)',
      'Basic analytics'
    ],
    active: true
  },
  {
    name: 'premium',
    price: 19.99,
    messageQuota: 2000,
    fileUploadAllowed: true,
    features: [
      'Send up to 2000 messages per month',
      'Web dashboard access',
      'API access',
      'Send files (images, documents, audio, video)',
      'Advanced analytics',
      'Priority support'
    ],
    active: true
  }
];

// Seed function
const seedPlans = async () => {
  try {
    // Clear existing plans
    await Plan.deleteMany({});
    console.log('Existing plans cleared');
    
    // Insert new plans
    const createdPlans = await Plan.insertMany(plansData);
    console.log(`${createdPlans.length} plans created`);
    
    // Disconnect from MongoDB
    mongoose.disconnect();
    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

// Run the seed function
seedPlans(); 