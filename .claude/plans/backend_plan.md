# Plan: Add Bun + TypeScript Backend to Order Tracker

## Context

The order tracker app currently uses localStorage for persistence. We need to add a real backend so data survives across devices/browsers and the app can be deployed on a VPS. The user already has a VPS running another app (neonchess) with Nginx + Docker Compose + Let's Encrypt. This app will be deployed alongside it.

**Key constraints:** Beginner developer, keep it simple, no over-engineering.

---

## Architecture

```
Browser (HTTPS)
    ↓
Nginx (reverse proxy, SSL termination)
    ↓ proxy_pass http://localhost:3002
Docker Container
    └── Bun (serves React static files + API)
            └── SQLite file (/data/orders.db)
```

**Tech choices:**
- **Runtime:** Bun (fast, built-in SQLite, TS-native)
- **Framework:** Express (already familiar to the developer, runs on Bun with no changes)
- **Database:** SQLite via `bun:sqlite` (built-in, no extra container, perfect for single-user)
- **Port:** 3100 (the other app uses 3000)

---

## New Directory Structure

Frontend stays in place. Backend added as `server/` directory.

```
order-tracker/
├── src/                          # Frontend (UNCHANGED location)
│   ├── services/orderService.ts  # MODIFIED: localStorage → fetch API
│   ├── hooks/useOrders.ts        # MODIFIED: sync → async actions
│   ├── types/order.ts            # UNCHANGED (server imports from here)
│   └── ...                       # Everything else unchanged
│
├── server/                       # NEW — entire backend
│   ├── src/
│   │   ├── app.ts                # Express app setup (importable for tests)
│   │   ├── index.ts              # Starts the server (calls app.listen)
│   │   ├── routes/
│   │   │   └── orders.ts         # CRUD API endpoints
│   │   └── db/
│   │       ├── database.ts       # SQLite connection + init
│   │       └── schema.sql        # Table definition
│   ├── tests/
│   │   ├── setup.ts              # Test helper: in-memory DB, fresh app per test
│   │   └── orders.test.ts        # All order endpoint tests (TDD)
│   ├── package.json              # Express + bun types
│   └── tsconfig.json
│
├── Dockerfile                    # NEW — multi-stage (build frontend, run Bun)
├── docker-compose.yml            # NEW — single service + volume for SQLite
├── docker-compose.prod.yml       # NEW — production overrides
├── deploy/                       # NEW
│   ├── deploy.sh                 # Production deployment script
│   └── nginx-order-tracker.conf  # Nginx reverse proxy config
├── .env.example                  # NEW — PORT, DB_PATH
├── .dockerignore                 # NEW
│
├── index.html                    # Existing (Vite entry)
├── vite.config.ts                # MODIFIED: add /api proxy for dev
├── package.json                  # MODIFIED: add root dev/build scripts
└── tsconfig.json                 # Existing
```

---

## API Design

REST endpoints that mirror the existing service layer 1:1:

| Method | Endpoint | Maps to | Returns |
|--------|----------|---------|---------|
| GET | `/api/orders` | `getAllOrders()` | `Order[]` |
| GET | `/api/orders/:id` | `getOrderById(id)` | `Order` |
| POST | `/api/orders` | `createOrder(formData)` | `Order` |
| PATCH | `/api/orders/:id` | `updateOrder(id, updates)` | `Order` |
| DELETE | `/api/orders/:id` | `deleteOrder(id)` | `{ deleted: true }` |

Response format: `{ success: true, data: ... }` or `{ success: false, error: "..." }`

---

## Implementation Phases

### Phase 1: Backend scaffolding (TDD)
**Files:** `server/` directory (all new)

**Approach:** Test-driven — write failing tests first, then implement code to make them pass.

**Step 1 — Project setup:**
1. Create `server/package.json` with `express` + `@types/express` dependencies
2. Create `server/tsconfig.json`
3. Create `server/src/db/schema.sql` — orders table matching the `Order` interface
4. Create `server/src/db/database.ts` — SQLite connection, migration runner, WAL mode
5. Create `server/src/app.ts` — Express app setup (exported, NOT listening — so tests can import it)
6. Create `server/src/index.ts` — imports app from `app.ts`, calls `app.listen()` (this is the entry point for running the server)

**Step 2 — Test infrastructure:**
7. Create `server/tests/setup.ts` — test helper that creates a fresh in-memory SQLite DB and a clean Express app instance for each test. This means tests are fast and isolated (no leftover data between tests).
8. Add `"test": "bun test"` script to `server/package.json`

**Step 3 — TDD cycle (for each endpoint):**
9. Create `server/tests/orders.test.ts` — write ALL tests first (they'll all fail):
   - `GET /api/orders` — returns empty array initially, returns orders after creating some
   - `GET /api/orders/:id` — returns order if exists, returns 404 if not
   - `POST /api/orders` — creates and returns order with generated id/timestamps, returns 400 for missing required fields
   - `PATCH /api/orders/:id` — updates specified fields only, updates `updatedAt`, returns 404 for bad id
   - `DELETE /api/orders/:id` — removes order, returns 404 for bad id
   - `GET /health` — returns `{ status: "ok" }`
10. Create `server/src/routes/orders.ts` — implement endpoints one by one until all tests pass

**Why app.ts is separate from index.ts:** Tests need to import the Express app without it starting a server on a port. `app.ts` exports the configured app, `index.ts` just calls `listen()`. This is a standard Express testing pattern.

**Verify:** `cd server && bun test` — all tests pass. Then `bun run src/index.ts` and manually curl a few endpoints.

### Phase 2: Frontend migration (localStorage → API)
**Files to modify:**

1. **`src/services/orderService.ts`** — Replace all localStorage calls with `fetch()` calls to `/api/...`. All functions become `async` returning `Promise<T>`.
2. **`src/hooks/useOrders.ts`** — Actions become async. Add `isLoading` state. Initial load via `useEffect` instead of lazy `useState`. Add error handling with toast notifications.
3. **`src/components/OrderTable.tsx`** — Show loading state when `isLoading` is true.
4. **`src/types/order.ts`** — No changes needed (server imports from here directly).

**Verify:** Frontend calls backend API for all operations. Create, edit, delete, filter, search all work.

### Phase 3: Dev workflow setup
**Files to modify/create:**

1. **`vite.config.ts`** — Add `server.proxy` to forward `/api` requests to `localhost:3001` during dev.
2. **`package.json`** (root) — Add scripts: `dev` (runs both frontend + backend concurrently), `dev:server`, `build`.
3. Install `concurrently` as dev dependency for running both servers.

**Verify:** `npm run dev` from root starts Vite on 5173 + Bun on 3001. Frontend HMR works. Backend auto-restarts on changes (`bun --watch`).

### Phase 4: Docker + deployment
**Files:** All new

1. **`Dockerfile`** — Multi-stage: Stage 1 builds frontend with Node (Vite needs it), Stage 2 runs Bun with backend + built frontend as static files.
2. **`docker-compose.yml`** — Single service, port 3002, named volume for SQLite data.
3. **`docker-compose.prod.yml`** — Production overrides (restart policy, env vars).
4. **`.dockerignore`** — Exclude node_modules, .git, etc.
5. **`.env.example`** — PORT, DB_PATH, NODE_ENV.
6. **`deploy/nginx-order-tracker.conf`** — Nginx config for the domain, proxying to localhost:3002.
7. **`deploy/deploy.sh`** — git pull, docker compose up --build, run migrations, show status.

**Verify:** `docker compose up --build` locally, visit `localhost:3002`, all CRUD works, data persists after container restart.

### Phase 5: VPS integration
**Not code changes — manual deployment steps:**

1. Add app entry to the VPS multi-app config (`config.env`)
2. Re-run `setup-infra.sh` to generate Nginx config + SSL for the new domain
3. Clone repo on VPS, run `deploy/deploy.sh`
4. Verify app works at `https://your-domain.com`

---

## Key Files to Modify (existing)

| File | What changes |
|------|-------------|
| `src/services/orderService.ts` | Full rewrite: localStorage → fetch API calls (async) |
| `src/hooks/useOrders.ts` | Actions become async, add isLoading + useEffect for initial load, error handling |
| `src/components/OrderTable.tsx` | Accept + display `isLoading` prop |
| `vite.config.ts` | Add dev server proxy config |
| `package.json` | Add `concurrently` dep, add root scripts |

## Key Files to Create (new)

| File | Purpose |
|------|---------|
| `server/src/app.ts` | Express app setup (importable by tests) |
| `server/src/index.ts` | Server entry point — imports app, calls listen() |
| `server/src/routes/orders.ts` | Express Router with all 5 CRUD endpoints |
| `server/tests/setup.ts` | Test helper: in-memory DB + fresh app per test |
| `server/tests/orders.test.ts` | All endpoint tests (written first in TDD) |
| `server/src/db/database.ts` | SQLite connection + migration |
| `server/src/db/schema.sql` | Orders table DDL |
| `server/package.json` | express, @types/express, bun types |
| `server/tsconfig.json` | Backend TS config |
| `Dockerfile` | Multi-stage build |
| `docker-compose.yml` | Container orchestration |
| `deploy/deploy.sh` | Deployment script |
| `deploy/nginx-order-tracker.conf` | Nginx proxy config |

---

## Testing Strategy

**Tool:** `bun test` (built-in, zero config, Jest-compatible API — `describe`, `test`, `expect`)

**Test isolation:** Each test gets a fresh in-memory SQLite database (`:memory:`). No test data leaks between tests. Tests are fast because there's no disk I/O.

**What we test (all in `server/tests/orders.test.ts`):**

| Endpoint | Happy path | Error cases |
|----------|-----------|-------------|
| `GET /api/orders` | Returns all orders sorted by date | Returns empty array when none exist |
| `GET /api/orders/:id` | Returns single order | 404 for non-existent id |
| `POST /api/orders` | Creates order, returns it with id + timestamps | 400 for missing required fields |
| `PATCH /api/orders/:id` | Updates only specified fields, bumps updatedAt | 404 for non-existent id |
| `DELETE /api/orders/:id` | Removes order, returns success | 404 for non-existent id |
| `GET /health` | Returns `{ status: "ok" }` | — |

**Running tests:**
```bash
cd server && bun test           # Run all tests
cd server && bun test --watch   # Re-run on file changes (useful during TDD)
```

---

## Verification Plan

**Automated (run after every change):**
- `cd server && bun test` — all backend tests pass

**Manual (after each phase):**
1. Create a new order → appears in the list
2. Edit an order's status → change persists after page refresh
3. Delete an order → removed from list
4. Filter by status → correct subset shown
5. Search by customer name → correct results
6. `docker compose up --build` → app accessible at localhost:3100
7. Restart container → data still there (SQLite volume persists)
