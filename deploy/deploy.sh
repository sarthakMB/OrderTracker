#!/bin/bash

# Deploy Order Tracker to production.
#
# Run from the project root on the VPS:
#   ./deploy/deploy.sh
#
# What it does:
#   1. Pulls latest code from main
#   2. Builds and starts the Docker container (with prod overrides)
#   3. Waits for the container to stabilize
#   4. Shows status and runs a health check

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Load configuration ---

if [ ! -f "$SCRIPT_DIR/.env.deploy" ]; then
    echo "Error: .env.deploy not found"
    exit 1
fi

source "$SCRIPT_DIR/.env.deploy"

echo "=== Deploying Order Tracker ==="

# --- Pull latest code ---

echo "Pulling latest code..."
git pull origin main

# --- Build and start ---

echo "Building and starting container..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# --- Wait for startup ---

echo "Waiting for container to start..."
sleep 5

# --- Verify ---

echo ""
echo "=== Container Status ==="
docker compose ps

echo ""
echo "=== Health Check ==="
if curl -sf http://localhost:${APP_PORT}/health > /dev/null 2>&1; then
    echo "Health check passed!"
    curl -s http://localhost:${APP_PORT}/health
    echo ""
else
    echo "Warning: Health check failed. Check logs with: docker compose logs -f app"
fi

echo ""
echo "=== Deploy complete ==="
