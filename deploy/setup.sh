#!/bin/bash

# First-time app registration with Nginx + SSL.
#
# Run once on the VPS after cloning the repo and configuring .env.deploy:
#   ./deploy/setup.sh
#
# What it does:
#   1. Creates Nginx config from template (replaces APP_DOMAIN with your domain)
#   2. Installs config to /etc/nginx/sites-available and symlinks to sites-enabled
#   3. Tests and reloads Nginx
#   4. Obtains SSL certificate via Certbot

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Load configuration ---

if [ ! -f "$SCRIPT_DIR/.env.deploy" ]; then
    echo "Error: .env.deploy not found"
    echo "Please configure your domain in deploy/.env.deploy"
    exit 1
fi

source "$SCRIPT_DIR/.env.deploy"

if [ -z "$DOMAIN" ]; then
    echo "Error: DOMAIN not set in .env.deploy"
    exit 1
fi
TEMPLATE="$SCRIPT_DIR/nginx-order-tracker.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/order-tracker"
NGINX_ENABLED="/etc/nginx/sites-enabled/order-tracker"

echo "Setting up Nginx for: $DOMAIN"

# --- Generate Nginx config ---

if [ ! -f "$TEMPLATE" ]; then
    echo "Error: Nginx template not found at $TEMPLATE"
    exit 1
fi

# Replace APP_DOMAIN placeholder with the actual domain
sed "s/APP_DOMAIN/$DOMAIN/g" "$TEMPLATE" > /tmp/order-tracker-nginx.conf

# Install the config
sudo cp /tmp/order-tracker-nginx.conf "$NGINX_AVAILABLE"
rm /tmp/order-tracker-nginx.conf

echo "Nginx config installed to $NGINX_AVAILABLE"

# --- Enable the site ---

if [ ! -L "$NGINX_ENABLED" ]; then
    sudo ln -s "$NGINX_AVAILABLE" "$NGINX_ENABLED"
    echo "Symlinked to sites-enabled"
else
    echo "Symlink already exists in sites-enabled"
fi

# --- Test and reload Nginx ---

echo "Testing Nginx config..."
sudo nginx -t

echo "Reloading Nginx..."
sudo systemctl reload nginx

echo "Nginx is now proxying $DOMAIN → localhost:3001"

# --- SSL via Certbot ---

echo ""
echo "Obtaining SSL certificate..."
sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN"

echo ""
echo "Verifying auto-renewal..."
sudo certbot renew --dry-run

echo ""
echo "Setup complete! $DOMAIN is ready."
echo "Next: run ./deploy/deploy.sh to build and start the app."
