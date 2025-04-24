const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const MessageLog = require('../models/MessageLog');

// Store active WhatsApp clients
const activeClients = {};

// Get Puppeteer args from environment variables or use defaults
const getPuppeteerArgs = () => {
  if (process.env.PUPPETEER_ARGS) {
    return process.env.PUPPETEER_ARGS.split(',');
  }
  return [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu'
  ];
};

// @desc    Initialize WhatsApp and get QR code
// @route   GET /api/whatsapp/init
// @access  Private
exports.initWhatsapp = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // If client already exists, destroy it to start fresh
    if (activeClients[userId]) {
      try {
        await activeClients[userId].destroy();
      } catch (error) {
        console.log('Error destroying previous client:', error.message);
      }
      delete activeClients[userId];
    }

    // Create client session directory
    const sessionDir = path.resolve(__dirname, `../sessions/${userId}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Get Puppeteer arguments
    const puppeteerArgs = getPuppeteerArgs();
    console.log('Using Puppeteer args:', puppeteerArgs);

    // Create a new client with proper configuration for cloud environments
    const client = new Client({
      authStrategy: new LocalAuth({ 
        clientId: userId, 
        dataPath: path.resolve(__dirname, '../sessions') 
      }),
      puppeteer: {
        headless: true,
        args: puppeteerArgs,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      }
    });
    
    // Store client globally
    activeClients[userId] = client;

    // Track whether a response has been sent to avoid multiple responses
    let responseHasBeenSent = false;
    
    // Function to send response if not already sent
    const sendResponse = (data) => {
      if (!responseHasBeenSent) {
        responseHasBeenSent = true;
        res.json(data);
      }
    };

    // Generate QR code
    let qrCode = null;
    client.on('qr', async (qr) => {
      console.log('QR RECEIVED', qr);
      try {
        qrCode = await qrcode.toDataURL(qr);
        sendResponse({ success: true, data: { qrCode } });
      } catch (error) {
        console.error('QR code generation error:', error);
        sendResponse({ success: false, message: 'Failed to generate QR code', error: error.message });
      }
    });

    // When client is ready
    client.on('ready', async () => {
      console.log('Client is ready!');
      // Update user status in database
      await User.findByIdAndUpdate(userId, { whatsappConnected: true });
      sendResponse({ success: true, data: { authenticated: true } });
    });

    // Handle authentication failure
    client.on('auth_failure', async (msg) => {
      console.error('AUTHENTICATION FAILURE', msg);
      await User.findByIdAndUpdate(userId, { whatsappConnected: false });
      sendResponse({ success: false, message: 'Authentication failed', error: msg });
    });

    // Handle disconnection
    client.on('disconnected', async (reason) => {
      console.log('Client was disconnected', reason);
      await User.findByIdAndUpdate(userId, { whatsappConnected: false });
      delete activeClients[userId];
    });

    // Initialize the client and handle initialization errors
    try {
      await client.initialize();
      
      // If no response sent after 20 seconds, check if authenticated
      setTimeout(async () => {
        if (!responseHasBeenSent) {
          try {
            // Check if the client is initialized
            if (client.info) {
              console.log('Client appears to be authenticated');
              await User.findByIdAndUpdate(userId, { whatsappConnected: true });
              sendResponse({ success: true, data: { authenticated: true } });
            } else {
              console.log('No response after timeout, sending default response');
              sendResponse({ success: true, data: { qrCode: null, message: 'Unable to generate QR code. Please try again.' } });
            }
          } catch (error) {
            console.error('Error in timeout handler:', error);
            sendResponse({ success: false, message: 'Initialization timed out', error: error.message });
          }
        }
      }, 20000);
    } catch (error) {
      console.error('Client initialization error:', error);
      sendResponse({ success: false, message: 'Failed to initialize WhatsApp client', error: error.message });
    }
    
  } catch (error) {
    console.error('WhatsApp initialization error:', error);
    res.status(500).json({ success: false, message: 'Could not initialize WhatsApp', error: error.message });
  }
};

// @desc    Check WhatsApp connection status
// @route   GET /api/whatsapp/status
// @access  Private
exports.getWhatsappStatus = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const user = await User.findById(userId);
    
    res.json({
      success: true,
      data: {
        connected: user.whatsappConnected,
        client: !!activeClients[userId]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Disconnect WhatsApp
// @route   POST /api/whatsapp/disconnect
// @access  Private
exports.disconnectWhatsapp = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // If client exists, destroy it
    if (activeClients[userId]) {
      await activeClients[userId].destroy();
      delete activeClients[userId];
    }
    
    // Update user status in database
    await User.findByIdAndUpdate(userId, { whatsappConnected: false });
    
    res.json({ success: true, message: 'WhatsApp disconnected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Send a message via WhatsApp
// @route   POST /api/whatsapp/send
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { phone, message } = req.body;
    
    // Validate input
    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'Phone number and message are required' });
    }
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    
    // Check client exists
    if (!activeClients[userId]) {
      return res.status(400).json({ success: false, message: 'WhatsApp client not connected' });
    }
    
    // Send message
    const client = activeClients[userId];
    const chatId = `${formattedPhone}@c.us`;
    
    // Log message
    const messageLog = new MessageLog({
      user: userId,
      recipient: formattedPhone,
      message,
      status: 'pending'
    });
    await messageLog.save();
    
    try {
      await client.sendMessage(chatId, message);
      
      // Update message log
      messageLog.status = 'sent';
      await messageLog.save();
      
      // Increment message count
      await User.findByIdAndUpdate(userId, { $inc: { messagesUsed: 1 } });
      
      res.json({ success: true, message: 'Message sent successfully', data: { messageId: messageLog._id } });
    } catch (error) {
      // Update message log
      messageLog.status = 'failed';
      messageLog.error = error.message;
      await messageLog.save();
      
      res.status(400).json({ success: false, message: 'Failed to send message', error: error.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Send a file via WhatsApp
// @route   POST /api/whatsapp/send-file
// @access  Private
exports.sendFile = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { phone, message } = req.body;
    const file = req.file;
    
    // Validate input
    if (!phone || !file) {
      return res.status(400).json({ success: false, message: 'Phone number and file are required' });
    }
    
    // Check user plan allows file uploads
    const user = await User.findById(userId);
    if (user.plan === 'free') {
      return res.status(403).json({ success: false, message: 'Your plan does not support file uploads' });
    }
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    
    // Check client exists
    if (!activeClients[userId]) {
      user.whatsappConnected = false;
      await user.save();
      return res.status(400).json({ success: false, message: 'WhatsApp client not connected', authenticated: false });
    }
    
    // Send file
    const client = activeClients[userId];
    const chatId = `${formattedPhone}@c.us`;
    const filePath = path.join(__dirname, '../uploads', file.filename);
    
    // Log message
    const messageLog = new MessageLog({
      user: userId,
      recipient: formattedPhone,
      message: message || 'File sent',
      fileUrl: `/uploads/${file.filename}`,
      status: 'pending'
    });
    await messageLog.save();
    
    try {
      const mediaFile = MessageMedia.fromFilePath(filePath);
      await client.sendMessage(chatId, mediaFile, { caption: message || undefined });
      
      // Update message log
      messageLog.status = 'sent';
      await messageLog.save();
      
      // Increment message count
      await User.findByIdAndUpdate(userId, { $inc: { messagesUsed: 1 } });
      
      res.json({ success: true, message: 'File sent successfully', data: { messageId: messageLog._id } });
    } catch (error) {
      // Update message log
      messageLog.status = 'failed';
      messageLog.error = error.message;
      await messageLog.save();
      
      res.status(400).json({ success: false, message: 'Failed to send file', error: error.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Format phone number
const formatPhoneNumber = (phone) => {
  let formattedPhone = phone.replace(/\D/g, '');
  
  // Ensure the number starts with a country code
  if (!formattedPhone.startsWith('1') && !formattedPhone.startsWith('91')) {
    formattedPhone = '91' + formattedPhone; // Default to India country code
  }
  
  return formattedPhone;
}; 