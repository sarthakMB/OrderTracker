# Deployment Guide

## Prerequisites

VPS with Ubuntu, Docker, Nginx, and Certbot installed. Point your domain's DNS A record to the VPS IP address.

## Steps

### 1. Clone the repo on the VPS

```bash
# Create /opt/apps if it doesn't exist (first time only)
sudo mkdir -p /opt/apps
sudo chown $USER:$USER /opt/apps

# Clone the repo
cd /opt/apps
git clone <repo-url> order-tracker
cd order-tracker
```

(Using `/opt/apps` keeps all your apps organized in one place, but any directory works.)

### 2. Configure deployment settings

```bash
nano deploy/.env.deploy  # Edit DOMAIN and APP_PORT
```

### 3. First-time setup (run once)

Register the app with Nginx and obtain SSL certificate:

```bash
./deploy/setup.sh
```

### 4. Deploy

Build and start the app:

```bash
./deploy/deploy.sh
```

The app will be running at `https://your-domain.com`

### 5. Updates

To deploy changes, just run `deploy.sh` again:

```bash
git pull origin main  # (deploy.sh does this automatically)
./deploy/deploy.sh
```

## Useful Commands

```bash
# View logs
docker compose logs -f app

# Restart the app
docker compose restart app

# Stop the app
docker compose down

# Check container status
docker compose ps
```
