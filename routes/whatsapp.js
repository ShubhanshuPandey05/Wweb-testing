const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { initWhatsapp, getWhatsappStatus, disconnectWhatsapp, sendMessage, sendFile } = require('../controllers/whatsapp');
const { protect, validateApiKey } = require('../middlewares/auth');

// Set up storage for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: function(req, file, cb) {
    // Check file types
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|mp3|mp4|wav|avi|mov/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: File upload only supports specific file types!'));
  }
});

// WhatsApp authentication routes (web interface)
router.get('/init', protect, initWhatsapp);
router.get('/status', protect, getWhatsappStatus);
router.post('/disconnect', protect, disconnectWhatsapp);

// WhatsApp messaging routes (web interface)
router.post('/send', protect, sendMessage);
router.post('/send-file', protect, upload.single('file'), sendFile);

// WhatsApp messaging routes (API endpoints for external use)
router.post('/api/send', validateApiKey, sendMessage);
router.post('/api/send-file', validateApiKey, upload.single('file'), sendFile);

module.exports = router; 