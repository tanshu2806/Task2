FROM node:18-slim

WORKDIR /usr/src/app

# Install native build tools for hnswlib (requires python and make/gcc)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package info and install
COPY package*.json ./
RUN npm install --production

# Copy application code and necessary pre-built files (index/store)
COPY . .

# Expose port
EXPOSE 3000

# Ensure uploads folder exists
RUN mkdir -p uploads

# Start the server
CMD ["node", "server.js"]
