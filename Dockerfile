# Use official lightweight Node image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Add Chromium alias so Puppeteer can find it
RUN ln -s /usr/bin/chromium /usr/bin/chromium-browser

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files and install dependencies
COPY package*.json ./

# Fix for EACCES errors
RUN chown -R node:node /app

# Switch to non-root user for better security
USER node

# Install node dependencies
RUN npm install

# Copy rest of app source
COPY --chown=node:node . .

# Expose your app port
EXPOSE 5000

# Start app
CMD ["node", "index.js"]