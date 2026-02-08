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
| `deploy/nginx.conf` | Nginx reverse proxy template |
| `deploy/setup.sh` | First-time app registration (Nginx + SSL) |
| `deploy/deploy.sh` | Production deployment |
| `deploy/test_deploy.sh` | Dev/staging deployment |
| `dev_private/deploy_repo/` | Shared VPS infrastructure setup (separate repo) |

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

## Deployment Architecture (Two-Repo Split)

Infrastructure setup is decoupled from app deployment. The VPS is provisioned once with shared infrastructure, then each app self-registers.

```
1. VPS Infra (one-time)          2. Per-App Setup (once per app)      3. Deploy (recurring)
   dev_private/deploy_repo/         deploy/setup.sh <domain>             deploy/deploy.sh <secret>
   └── setup-vps.sh                 └── Registers Nginx + SSL            └── git pull, build, start
```

### Shared Infrastructure (`dev_private/deploy_repo/`)

App-agnostic VPS setup. Intended to live in its own repo (e.g., `vps-infra`). Run once on a fresh Ubuntu VPS.

```bash
./setup-vps.sh
```

What it does:
1. **System update** — `apt update && apt upgrade`
2. **Install Git** — if not present
3. **Install Docker** — via `get.docker.com`, adds user to docker group
4. **Install Nginx** — enables systemd service, removes default site
5. **Install Certbot** — with nginx plugin
6. **Firewall (UFW)** — allows SSH + Nginx Full

All steps are idempotent (`command -v` checks before installing).

After running, **log out and back in** for Docker group membership.

### Per-App Setup (`deploy/setup.sh <domain>`)

First-time registration of this app with Nginx. Run once after cloning on the VPS.

```bash
./deploy/setup.sh chess.example.com
```

What it does:
1. Generates Nginx config from `deploy/nginx.conf` template (replaces `APP_DOMAIN`)
2. Installs to `/etc/nginx/sites-available/chess-app`, symlinks to `sites-enabled`
3. Tests and reloads Nginx
4. Obtains SSL via `certbot --nginx` for domain + www variant
5. Verifies auto-renewal with dry-run

---

## Nginx Configuration (`deploy/nginx.conf`)

```nginx
server {
    listen 80;
    server_name APP_DOMAIN www.APP_DOMAIN;

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

- `APP_DOMAIN` placeholder is replaced by `deploy/setup.sh` at install time.
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
# One-time VPS infra setup (from vps-infra repo)
./setup-vps.sh
# (log out, log back in)

# One-time app registration
./deploy/setup.sh chess.example.com

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

## Multi-App VPS Pattern

Each app self-registers with Nginx via its own `deploy/setup.sh`. No centralized config file needed.

```
Nginx (shared, installed by vps-infra/setup-vps.sh)
  ├── chess.example.com    → localhost:3000  (registered by chess app's setup.sh)
  ├── portfolio.example.com → localhost:3001  (registered by portfolio app's setup.sh)
  └── blog.example.com     → localhost:3002  (registered by blog app's setup.sh)
```

To add a new app:
1. Clone the app repo on the VPS
2. Run its `deploy/setup.sh <domain>` (registers Nginx config + SSL)
3. Run its `deploy/deploy.sh` (builds and starts containers)

Each app owns its own Nginx config template, SSL registration, and Docker Compose stack. No shared config to coordinate.

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
| Two-repo split (infra + app) | Decoupled: VPS setup is app-agnostic, each app self-registers |
| Self-registration over centralized config | No coordination needed when adding apps; each app is independent |
