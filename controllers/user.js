const User = require('../models/User');
const Plan = require('../models/Plan');
const crypto = require('crypto');

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user._id;

    // Check if email is already taken
    if (email && email !== req.user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email is already taken' });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Change password
// @route   PUT /api/user/password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Get user
    const user = await User.findById(userId);

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Generate new API key
// @route   POST /api/user/api-key
// @access  Private
exports.generateApiKey = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Generate new API key
    const apiKey = userId + '-' + crypto.randomBytes(16).toString('hex');
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { apiKey },
      { new: true }
    ).select('-password');
    
    res.json({
      success: true,
      data: {
        apiKey: updatedUser.apiKey
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all available plans
// @route   GET /api/user/plans
// @access  Public
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ active: true });
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Upgrade user plan
// @route   POST /api/user/upgrade-plan
// @access  Private
exports.upgradePlan = async (req, res) => {
  try {
    const { planName } = req.body;
    const userId = req.user._id;
    
    // Find the plan
    const plan = await Plan.findOne({ name: planName, active: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }
    
    // TODO: Here you would integrate with a payment gateway
    // For now, we'll just update the user's plan
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        plan: plan.name,
        messageQuota: plan.messageQuota
      },
      { new: true }
    ).select('-password');
    
    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: {
        plan: updatedUser.plan,
        messageQuota: updatedUser.messageQuota
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}; 