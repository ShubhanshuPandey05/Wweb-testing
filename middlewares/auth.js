const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect routes
exports.protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Set user to req.user
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// Middleware to validate API key
exports.validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'API key is required' });
  }

  try {
    // Find user with the provided API key
    const user = await User.findOne({ apiKey });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    // Check message quota
    if (user.messagesUsed >= user.messageQuota) {
      return res.status(403).json({ success: false, message: 'Message quota exceeded' });
    }

    // Check if WhatsApp is connected
    if (!user.whatsappConnected) {
      return res.status(403).json({ success: false, message: 'WhatsApp not connected' });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}; 