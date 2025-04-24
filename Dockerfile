# Use official lightweight Node image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install Google Chrome and dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    gnupg \
    procps \
    dumb-init \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set up swap file
USER root
RUN fallocate -l 1G /swapfile && \
    chmod 600 /swapfile && \
    mkswap /swapfile && \
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_ARGS="--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-accelerated-2d-canvas,--no-first-run,--no-zygote,--single-process,--disable-gpu,--disable-extensions,--disable-component-extensions-with-background-pages,--disable-default-apps,--disable-background-networking,--mute-audio,--hide-scrollbars"

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

# Make the start script executable
USER root
RUN chmod +x start.sh

# Set up startup script to enable swap
RUN echo '#!/bin/bash\n\
# Enable swap\n\
swapon /swapfile\n\
\n\
# Start the app using dumb-init to handle signals properly\n\
exec dumb-init ./start.sh\n\
' > /startup.sh && chmod +x /startup.sh

USER node

# Expose your app port
EXPOSE 5000

# Increase Node memory limit
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Start app using the startup script
ENTRYPOINT ["/startup.sh"]