const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const puppeteer = require('puppeteer-core');
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
    '--disable-gpu',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-background-networking',
    '--mute-audio',
    '--hide-scrollbars'
  ];
};

// Custom browser launcher to handle browser initialization safely
const createBrowser = async () => {
  console.log('Launching custom browser...');
  const args = getPuppeteerArgs();
  
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: args,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      ignoreHTTPSErrors: true,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      timeout: 120000,
      protocolTimeout: 120000,
      defaultViewport: {
        width: 1280,
        height: 900
      }
    });
    
    // Event listeners to prevent unexpected closures
    browser.on('disconnected', () => {
      console.log('Browser disconnected event fired');
    });
    
    // Create and prepare initial page to ensure browser is working
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36');
    
    // Navigate to a blank page to test browser
    await page.goto('about:blank');
    console.log('Browser launched and initial page loaded successfully');
    
    return browser;
  } catch (error) {
    console.error('Error launching browser:', error);
    throw error;
  }
};

// Clean client sessions to prevent corruption
const cleanSessions = (userId) => {
  try {
    const sessionDir = path.resolve(__dirname, `../sessions/${userId}`);
    if (fs.existsSync(sessionDir)) {
      console.log(`Cleaning session directory for user ${userId}`);
      
      // Keep these files/folders but remove all others to ensure clean state
      const keepFiles = ['.'];
      
      // Get all files in the session directory
      const files = fs.readdirSync(sessionDir);
      
      // Remove each file that's not in the keepFiles list
      for (const file of files) {
        if (!keepFiles.includes(file)) {
          const filePath = path.join(sessionDir, file);
          try {
            if (fs.lstatSync(filePath).isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error(`Error removing file ${filePath}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error cleaning sessions for user ${userId}:`, error.message);
  }
};

// Properly destroy a client
const destroyClient = async (client) => {
  if (!client) return;

  return new Promise((resolve) => {
    try {
      // Add a timeout to make sure we don't hang
      const timeout = setTimeout(() => {
        console.log('Destroy client timed out, forcing resolve');
        
        // If client has a browser property, try to close it directly
        if (client._browser) {
          try {
            console.log('Attempting to close browser directly after timeout');
            client._browser.close().catch(e => console.error('Error closing browser:', e.message));
          } catch (err) {
            console.error('Error in browser close after timeout:', err.message);
          }
        }
        
        resolve();
      }, 10000);

      // Store browser reference before destroying client
      const browser = client._browser;

      client.destroy()
        .then(() => {
          clearTimeout(timeout);
          
          // After successful client destroy, ensure browser is also closed
          if (browser) {
            console.log('Client destroyed, closing browser');
            browser.close().catch(e => console.error('Error closing browser after destroy:', e.message));
          }
          
          resolve();
        })
        .catch((error) => {
          console.error('Error during client destroy:', error.message);
          clearTimeout(timeout);
          
          // If client destroy fails, try to close browser directly
          if (browser) {
            console.log('Client destroy failed, trying to close browser directly');
            browser.close().catch(e => console.error('Error closing browser after failed destroy:', e.message));
          }
          
          resolve();
        });
    } catch (error) {
      console.error('Exception during destroyClient:', error.message);
      
      // Final attempt to close browser if all else fails
      try {
        if (client._browser) {
          console.log('Exception in destroyClient, final attempt to close browser');
          client._browser.close().catch(e => console.error('Error in final browser close:', e.message));
        }
      } catch (err) {
        console.error('Error in final browser close attempt:', err.message);
      }
      
      resolve();
    }
  });
};

// @desc    Initialize WhatsApp and get QR code
// @route   GET /api/whatsapp/init
// @access  Private
exports.initWhatsapp = async (req, res) => {
  let browser = null;
  
  try {
    const userId = req.user._id.toString();
    
    // If client already exists, destroy it to start fresh
    if (activeClients[userId]) {
      try {
        console.log('Destroying existing client');
        await destroyClient(activeClients[userId]);
      } catch (error) {
        console.log('Error destroying previous client:', error.message);
      }
      delete activeClients[userId];
    }

    // Clean sessions to prevent corrupted state
    cleanSessions(userId);

    // Create client session directory
    const sessionDir = path.resolve(__dirname, `../sessions/${userId}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Get Puppeteer arguments
    const puppeteerArgs = getPuppeteerArgs();
    console.log('Using Puppeteer args:', puppeteerArgs);

    // Launch custom browser first
    try {
      console.log('Launching browser...');
      browser = await createBrowser();
      console.log('Browser launched successfully');
    } catch (error) {
      console.error('Failed to launch browser:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to initialize WhatsApp - browser launch failed', 
        error: error.message 
      });
    }

    // Create a new client with proper configuration for cloud environments
    console.log('Creating WhatsApp client with custom browser');
    const client = new Client({
      authStrategy: new LocalAuth({ 
        clientId: userId, 
        dataPath: path.resolve(__dirname, '../sessions') 
      }),
      puppeteer: {
        browser: browser, // Use our pre-initialized browser
      },
      webVersion: '2.2334.12',
      webVersionCache: {
        type: 'none',
      },
      restartOnAuthFail: true,
      takeoverOnConflict: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    });
    
    // Store browser reference for cleanup
    client._browser = browser;
    
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
    let hasReceivedQr = false;
    
    client.on('qr', async (qr) => {
      console.log('QR RECEIVED', qr.substring(0, 20) + '...');
      hasReceivedQr = true;
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
      // Clean sessions on auth failure to force fresh login
      cleanSessions(userId);
      sendResponse({ success: false, message: 'Authentication failed', error: msg });
    });

    // Handle disconnection
    client.on('disconnected', async (reason) => {
      console.log('Client was disconnected', reason);
      await User.findByIdAndUpdate(userId, { whatsappConnected: false });
      // Clean up properly
      try {
        await destroyClient(activeClients[userId]);
      } catch (error) {
        console.error('Error destroying client on disconnect:', error.message);
      }
      delete activeClients[userId];
    });

    // Initialize the client and handle initialization errors
    try {
      console.log('Starting WhatsApp client initialization...');
      
      // Add a timeout that will check QR status
      const qrTimeout = setTimeout(() => {
        if (!hasReceivedQr && !responseHasBeenSent) {
          console.log('No QR received after timeout, trying to recover...');
          
          try {
            if (browser && !browser.isConnected()) {
              console.log('Browser disconnected, sending failure response');
              sendResponse({ 
                success: false, 
                message: 'Failed to initialize WhatsApp - browser disconnected',
                error: 'Browser disconnected before QR code generation'
              });
            } else {
              console.log('No QR generated but browser is connected, sending retry message');
              sendResponse({ 
                success: false, 
                message: 'Failed to generate QR code. Please try again.',
                error: 'QR code generation timed out' 
              });
            }
          } catch (error) {
            console.error('Error in QR timeout handler:', error);
            sendResponse({ 
              success: false, 
              message: 'Failed to initialize WhatsApp',
              error: error.message
            });
          }
        }
      }, 20000);
      
      // Add initialization timeout
      const initPromise = client.initialize();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('WhatsApp initialization timed out after 45 seconds')), 45000);
      });
      
      // Race the initialization against the timeout
      await Promise.race([initPromise, timeoutPromise]);
      clearTimeout(qrTimeout);
      
      // If no response sent after 30 seconds, check if authenticated
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
      }, 30000);
    } catch (error) {
      console.error('Client initialization error:', error);
      // Clean sessions on initialization error
      cleanSessions(userId);
      sendResponse({ success: false, message: 'Failed to initialize WhatsApp client', error: error.message });
      
      // Close browser on error
      try {
        if (browser) await browser.close();
      } catch (err) {
        console.error('Error closing browser after initialization failure:', err);
      }
    }
    
  } catch (error) {
    console.error('WhatsApp initialization error:', error);
    
    // Cleanup browser if it exists
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.error('Error closing browser after general error:', err);
      }
    }
    
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
      await destroyClient(activeClients[userId]);
      delete activeClients[userId];
    }
    
    // Clean sessions on disconnect
    cleanSessions(userId);
    
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