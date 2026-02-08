# Stage 1 — Build the React frontend
# Using Node (not Bun) because Vite and the frontend toolchain are Node-based.
FROM node:20-alpine AS builder

WORKDIR /app

# Install frontend dependencies first (cached unless package files change)
COPY package.json package-lock.json ./
RUN npm ci

# Copy only the files Vite needs to build the frontend
COPY index.html vite.config.ts tsconfig*.json ./
COPY public/ public/
COPY src/ src/
COPY components.json ./

# Build the React app → outputs to dist/
RUN npm run build:frontend


# Stage 2 — Production server (Bun)
# Bun runs the Express backend and serves the built React files.
FROM oven/bun:1-alpine

WORKDIR /app

# Create the data directory for SQLite (will be mounted as a volume)
RUN mkdir -p /app/data

# Install server dependencies only (no devDeps needed in production)
COPY server/package.json server/bun.lock server/
RUN cd server && bun install --production

# Copy server source code
COPY server/src/ server/src/

# Copy the built React frontend from Stage 1
COPY --from=builder /app/dist/ dist/

# The Express server listens on this port
EXPOSE 3001

# Health check — Docker uses this to know if the container is healthy.
# wget is available in Alpine by default (curl is not).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Set production mode so Express serves static files (see app.ts:45)
ENV NODE_ENV=production

# Start the Bun server
CMD ["bun", "server/src/index.ts"]
