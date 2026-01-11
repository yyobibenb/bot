FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm install -g typescript tsx
RUN npx tsc

# Expose port
EXPOSE 5000

# Start the app
CMD ["node", "dist/index.js"]
