#!/bin/bash

# Print system information
echo "===== SYSTEM INFORMATION ====="
echo "Hostname: $(hostname)"
echo "Date: $(date)"
echo "Memory:"
free -h
echo "Disk space:"
df -h

# Check for swap
if [ -e /swapfile ]; then
  echo "Swap file exists, enabling swap..."
  swapon -v /swapfile
  echo "After enabling swap:"
  free -h
else
  echo "No swap file found at /swapfile"
fi

# Set Puppeteer environment variables if not already set
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=${PUPPETEER_EXECUTABLE_PATH:-/usr/bin/google-chrome-stable}
export PUPPETEER_ARGS=${PUPPETEER_ARGS:-"--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-accelerated-2d-canvas,--no-first-run,--no-zygote,--single-process,--disable-gpu,--disable-extensions,--disable-component-extensions-with-background-pages,--disable-default-apps,--disable-background-networking,--mute-audio,--hide-scrollbars"}
export NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=4096"}

# Verify Chrome installation
echo "===== CHROME VERIFICATION ====="
if [ -f "$PUPPETEER_EXECUTABLE_PATH" ]; then
  echo "Chrome found at $PUPPETEER_EXECUTABLE_PATH"
  "$PUPPETEER_EXECUTABLE_PATH" --version
else
  echo "ERROR: Chrome not found at $PUPPETEER_EXECUTABLE_PATH"
  which google-chrome || echo "google-chrome not found in PATH"
  which chromium || echo "chromium not found in PATH"
fi

# Print configuration for debugging
echo "===== ENVIRONMENT CONFIG ====="
echo "Using Puppeteer executable: $PUPPETEER_EXECUTABLE_PATH"
echo "Using Puppeteer args: $PUPPETEER_ARGS"
echo "Using Node options: $NODE_OPTIONS"

# Create sessions directory if it doesn't exist
echo "Creating sessions directory..."
mkdir -p sessions

# Fix permissions on sessions directory
chmod -R 755 sessions

# Start the application
echo "===== STARTING APPLICATION ====="
node index.js 