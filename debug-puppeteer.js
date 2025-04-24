const puppeteer = require('puppeteer-core');

async function debugPuppeteer() {
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
    // Attempt to launch browser
    console.log('Attempting to launch browser...');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: args,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
    
    console.log('Browser launched successfully!');
    
    // Get browser version
    const version = await browser.version();
    console.log('Browser version:', version);
    
    // Create a page and navigate to it
    const page = await browser.newPage();
    console.log('New page created');
    
    await page.goto('https://www.example.com');
    console.log('Navigation successful');
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Close browser
    await browser.close();
    console.log('Browser closed successfully');
    console.log('Puppeteer is working correctly!');
    
  } catch (error) {
    console.error('Error in Puppeteer debugging:');
    console.error(error);
  }
}

debugPuppeteer(); 