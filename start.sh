#!/bin/bash

# Set Puppeteer environment variables if not already set
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=${PUPPETEER_EXECUTABLE_PATH:-/usr/bin/google-chrome-stable}
export PUPPETEER_ARGS=${PUPPETEER_ARGS:-"--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-accelerated-2d-canvas,--no-first-run,--no-zygote,--single-process,--disable-gpu"}
export NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=2048"}

# Print configuration for debugging
echo "Using Puppeteer executable: $PUPPETEER_EXECUTABLE_PATH"
echo "Using Puppeteer args: $PUPPETEER_ARGS"
echo "Using Node options: $NODE_OPTIONS"

# Start the application
node index.js 