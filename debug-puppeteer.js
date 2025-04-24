const puppeteer = require('puppeteer-core');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

async function debugSystemInfo() {
  console.log('===== SYSTEM INFORMATION =====');
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
  console.log('Architecture:', process.arch);
  
  // Check memory
  const totalMem = Math.round(require('os').totalmem() / (1024 * 1024 * 1024) * 10) / 10;
  const freeMem = Math.round(require('os').freemem() / (1024 * 1024 * 1024) * 10) / 10;
  console.log(`Total memory: ${totalMem}GB, Free memory: ${freeMem}GB`);
  
  // Check Chrome executable
  try {
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      console.log('Chrome executable exists:', process.env.PUPPETEER_EXECUTABLE_PATH);
    } else {
      console.log('Chrome executable not found at:', process.env.PUPPETEER_EXECUTABLE_PATH || 'undefined');
    }
  } catch (error) {
    console.error('Error checking Chrome executable:', error.message);
  }
  
  // Try to list Chrome version
  try {
    const { execSync } = require('child_process');
    const chromeVersion = execSync(`${process.env.PUPPETEER_EXECUTABLE_PATH || 'google-chrome'} --version`).toString().trim();
    console.log('Chrome version:', chromeVersion);
  } catch (error) {
    console.error('Error getting Chrome version:', error.message);
  }
  
  console.log('===== END SYSTEM INFO =====\n');
}

async function debugPuppeteer() {
  await debugSystemInfo();
  
  console.log('===== PUPPETEER DEBUG =====');
  console.log('Debugging Puppeteer installation...');
  
  // Log environment variables
  console.log('PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
  console.log('PUPPETEER_ARGS:', process.env.PUPPETEER_ARGS);
  
  const args = process.env.PUPPETEER_ARGS ? process.env.PUPPETEER_ARGS.split(',') : [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu'
  ];
  
  console.log('Using arguments:', args);
  
  try {
    // Attempt to launch browser with puppeteer directly
    console.log('1. Attempting to launch browser with puppeteer-core...');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: args,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      ignoreHTTPSErrors: true,
      protocolTimeout: 60000,
      timeout: 60000,
    });
    
    console.log('Browser launched successfully!');
    
    // Get browser version
    const version = await browser.version();
    console.log('Browser version:', version);
    
    // Create a page and navigate to it
    const page = await browser.newPage();
    console.log('New page created');
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36');
    console.log('User agent set');
    
    // Navigate to a simple page first
    await page.goto('https://www.example.com');
    console.log('Navigation to example.com successful');
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Close browser
    await browser.close();
    console.log('Browser closed successfully');
    console.log('Puppeteer direct test is working correctly!');
    
  } catch (error) {
    console.error('Error in Puppeteer direct testing:');
    console.error(error);
  }
  
  console.log('\n===== WHATSAPP-WEB.JS DEBUG =====');
  
  try {
    // Create test directory
    const testDir = path.resolve(__dirname, 'test-session');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    console.log('2. Testing with whatsapp-web.js...');
    console.log('Creating client with LocalAuth...');
    
    // Create whatsapp-web.js client
    const client = new Client({
      authStrategy: new LocalAuth({ 
        clientId: 'test-session',
        dataPath: path.resolve(__dirname, '.') 
      }),
      puppeteer: {
        headless: true,
        args: args,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
        ignoreHTTPSErrors: true,
        protocolTimeout: 60000,
        timeout: 60000,
      },
      webVersion: '2.2334.12',
      webVersionCache: {
        type: 'none',
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    });
    
    // Set up event handlers
    client.on('qr', (qr) => {
      console.log('QR RECEIVED:', qr.substring(0, 40) + '...');
      console.log('WhatsApp QR code generation working!');
      // We got QR code, no need to proceed further for test
      process.exit(0);
    });
    
    client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      process.exit(0);
    });
    
    client.on('auth_failure', (msg) => {
      console.error('AUTHENTICATION FAILURE:', msg);
      process.exit(1);
    });
    
    // Add error handler
    client.on('disconnected', (reason) => {
      console.log('Client was disconnected:', reason);
      process.exit(1);
    });
    
    // Initialize with timeout
    console.log('Initializing WhatsApp client...');
    
    // Set a timeout to exit after 30 seconds regardless
    setTimeout(() => {
      console.log('Test timed out but no errors occurred.');
      console.log('WhatsApp-web.js initialization test passed if QR was generated.');
      process.exit(0);
    }, 30000);
    
    await client.initialize();
    
  } catch (error) {
    console.error('Error in WhatsApp-web.js testing:');
    console.error(error);
    process.exit(1);
  }
}

debugPuppeteer(); 