# Deployment Infrastructure

This document covers the full deployment pipeline — Docker setup, Nginx reverse proxy, SSL, VPS provisioning, and the multi-app pattern.

---

## Architecture Overview

```
User Browser (HTTPS)
    ↓
Nginx (reverse proxy, SSL termination, port 80/443)
    ↓ proxy_pass http://localhost:3000
Docker Compose
    ├── app (Node.js, port 3000)
    ├── postgres (PostgreSQL 16, port 5432 — internal only in prod)
    └── redis (Redis 7, port 6379 — internal only in prod)
```

**Stack:** Docker Compose + Nginx + Let's Encrypt (Certbot) on an Ubuntu VPS (AWS Lightsail or similar).

---

## File Inventory

| Path | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage container build |
| `docker-compose.yml` | Base config (dev defaults) |
| `docker-compose.prod.yml` | Production overrides |
| `.dockerignore` | Excludes from build context |
| `.env.example` | Config template (Docker service names) |
| `.env.example.local` | Config template (localhost, for local dev) |
| `deploy/setup-vps.sh` | One-time VPS initialization |
| `deploy/deploy.sh` | Production deployment |
| `deploy/test_deploy.sh` | Dev/staging deployment |
| `deploy/nginx-chess-app.conf` | Nginx reverse proxy config |
| `dev_private/deploy_repo/vps-infra/` | Multi-app VPS infrastructure |

---

## Docker Configuration

### Dockerfile (Multi-stage)

**Stage 1 — Builder:** Installs all dependencies (including devDeps) and copies full source.

**Stage 2 — Production:** Fresh `node:20-alpine` image, installs only production deps (`npm ci --omit=dev`), copies only needed directories (`src/`, `public/`, `config/`, `db/`, `utils/`) from builder. Exposes port 3000, runs `node src/app.mjs`.

Result: a smaller production image without build tools or dev dependencies.

### docker-compose.yml (Base / Dev)

| Service | Image | Ports | Health Check |
|---------|-------|-------|--------------|
| **app** | Builds from Dockerfile | 3000:3000 | — |
| **postgres** | postgres:16-alpine | 5432:5432 | `pg_isready` |
| **redis** | redis:7-alpine | 6379:6379 | `redis-cli ping` |

- App depends on postgres and redis being healthy (`condition: service_healthy`).
- Source code mounted read-only (`./src:/app/src:ro`, `./public:/app/public:ro`) for hot-reload in dev.
- Named volumes (`postgres_data`, `redis_data`) for persistent data.
- `tty: true` enables colored terminal output.

### docker-compose.prod.yml (Production Overrides)

Applied via: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`

What it changes:
- Sets `NODE_ENV=production`, injects `SESSION_SECRET` from `.env`, sets `PINO=compact`.
- **Removes source mounts** — uses the built image only.
- **Hides database ports** — postgres and redis not accessible from host.
- Adds `restart: unless-stopped` to all services.

### .dockerignore

Excludes `node_modules/`, `.git/`, `*.log`, `.env*`, `*.md`, `.claude/`, `scripts/`, IDE configs, and Docker files themselves from the build context.

---

## Environment Configuration

Two `.env.example` files:

| File | Database/Redis Host | Use Case |
|------|-------------------|----------|
| `.env.example` | `postgres` / `redis` (Docker service names) | Running everything in Docker |
| `.env.example.local` | `localhost` | Running app locally, databases in Docker |

Key variables: `PORT`, `SESSION_SECRET`, `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `PG_POOL_MAX`, `PINO`, `DEBUG`.

---

## VPS Setup (`deploy/setup-vps.sh`)

One-time initialization of a fresh Ubuntu VPS. Usage:

```bash
./deploy/setup-vps.sh yourdomain.com
```

What it does:

1. **System update** — `apt update && apt upgrade`
2. **Install Docker** — via `get.docker.com`, adds user to docker group
3. **Install Nginx** — reverse proxy
4. **Install Certbot** — SSL certificate management
5. **Configure Nginx** — replaces `yourdomain.com` in the template, installs to `/etc/nginx/sites-available/chess-app`, enables site, removes default, tests and reloads
6. **Obtain SSL** — `certbot --nginx` for domain + www variant, non-interactive, email `admin@<domain>`
7. **Test auto-renewal** — `certbot renew --dry-run`
8. **Firewall (UFW)** — allows SSH, HTTP (80), HTTPS (443), enables firewall

After running, log out and back in for Docker group membership to take effect.

---

## Nginx Configuration (`deploy/nginx-chess-app.conf`)

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forward client info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeouts for WebSocket (24 hours)
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

- `Upgrade` + `Connection: upgrade` headers enable WebSocket protocol upgrade (required for Socket.IO).
- 24-hour read/send timeouts prevent premature WebSocket disconnection.
- Certbot automatically modifies this to add HTTPS listener (port 443), HTTP→HTTPS redirect, and SSL cert paths.

---

## Deployment Scripts

### Production: `deploy/deploy.sh <SESSION_SECRET>`

1. `git pull origin main`
2. Creates `.env` from `.env.example`, injects `SESSION_SECRET`
3. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
4. Waits 5 seconds for containers to stabilize
5. Runs migrations: `docker compose exec -T app npm run migrate`
6. Shows container status

### Dev/Staging: `deploy/test_deploy.sh <SESSION_SECRET>`

Same as `deploy.sh` but uses **base compose only** (no prod overrides):
- Ports exposed (postgres, redis accessible from host)
- Dev-mode logging (pretty, colored)
- Source mounts active

### Quick Reference

```bash
# First-time setup
./deploy/setup-vps.sh chess.example.com
# (log out, log back in)

# Deploy production
./deploy/deploy.sh "your-secret-key"

# Deploy staging/dev
./deploy/test_deploy.sh "your-secret-key"

# Redeploy (same command — pulls latest, rebuilds)
./deploy/deploy.sh "your-secret-key"

# View logs
docker compose logs -f --no-log-prefix app

# Run migrations manually
docker compose exec -T app npm run migrate

# SSH into app container
docker compose exec -it app sh
```

---

## Multi-App VPS Setup (Advanced)

**Location:** `dev_private/deploy_repo/vps-infra/`

For hosting multiple apps on a single VPS with centralized Nginx and SSL.

### How It Works

```
Nginx (central, manages all domains/SSL)
  ├── chess.example.com    → localhost:3000
  ├── portfolio.example.com → localhost:3001
  └── blog.example.com     → localhost:3002
```

Each app runs its own Docker Compose on a unique host port. Nginx routes by domain.

### Files

| File | Purpose |
|------|---------|
| `config.env` | Defines apps as `"name:domain:port"` entries |
| `setup-infra.sh` | Generates Nginx configs, obtains SSL for all domains |
| `templates/nginx-app.conf` | Nginx template with `{{APP_NAME}}`, `{{DOMAIN}}`, `{{PORT}}` placeholders |

### config.env

```bash
APPS=(
  "neonchess:neonchess.example.com:3000"
  # "portfolio:example.com:3001"
)
CERTBOT_EMAIL="admin@example.com"
```

### setup-infra.sh

1. Reads `config.env`
2. Installs Nginx + Certbot if missing
3. For each app: generates Nginx config from template, enables site
4. Runs single `certbot --nginx` for all domains at once
5. Sets up UFW firewall

### Adding a New App

1. Add entry to `config.env`
2. Re-run `setup-infra.sh`
3. Deploy the app to its own directory with `docker compose up -d` on the assigned port

---

## Security Notes

**Protected:**
- HTTPS via Let's Encrypt with auto-renewal
- Databases not exposed to host in production
- Secrets injected at runtime (not baked into images)
- UFW firewall (SSH + HTTP/HTTPS only)

**Not in scope (add separately as needed):**
- SSH hardening (key-only auth assumed)
- DDoS / WAF / rate limiting
- Automated database backups
- Monitoring / alerting (Prometheus, Datadog, etc.)

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Docker Compose (not K8s) | Simplicity for single-VPS scale |
| Nginx reverse proxy | Handles SSL termination + WebSocket upgrade |
| Let's Encrypt via Certbot | Free, automatic, industry standard |
| Multi-stage Dockerfile | Smaller production image |
| Compose override files | DRY: one base config, env-specific tweaks |
| Separated scripts (setup / deploy / test_deploy) | Clear intent: one-time vs recurring |
| Multi-app infra optional | Simple path works first; scale when needed |
