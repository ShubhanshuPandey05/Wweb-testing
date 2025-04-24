const express = require('express');
const router = express.Router();
const { updateProfile, changePassword, generateApiKey, getPlans, upgradePlan } = require('../controllers/user');
const { protect } = require('../middlewares/auth');

// User routes
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.post('/api-key', protect, generateApiKey);
router.get('/plans', getPlans); // Public route
router.post('/upgrade-plan', protect, upgradePlan);

module.exports = router; 