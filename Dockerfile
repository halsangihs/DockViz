# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy package files and install dependencies
COPY client/package*.json ./
RUN npm install

# Copy source and build
COPY client/ ./
RUN npm run build


# Stage 2: Build the backend and serve
FROM node:20-alpine AS server

WORKDIR /app/server

# Copy package files and install dependencies (only production)
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY server/ ./

# Create a public folder and copy the frontend build artifacts
RUN mkdir -p public
COPY --from=frontend-builder /app/client/dist ./public

# Expose the server port (default 5000)
EXPOSE 5000

# Start the Node.js server
CMD ["node", "index.js"]