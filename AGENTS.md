# Order Tracker — Printing Business

Start: say hi + 1 motivating line. Work style: telegraph; noun-phrases ok; drop grammar; min tokens.


## About
A simple order tracking web app for a small printing shop. The owner handles many orders and needs to track:
- **Who** placed the order (customer name/details)
- **Where** the order is (which vendor is currently processing it)
- **Status** of the order (new, in progress, delivered, delayed, etc.)

The app should be dead simple — no over-engineering. The primary user is a non-technical shop owner.

## Tech Stack
- **Frontend:** React + TypeScript (Vite)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Backend:** Bun + Express + TypeScript
- **Database:** SQLite via `bun:sqlite`
- **Testing:** `bun test` (built-in, Jest-compatible API)
- **Deployment:** Docker Compose + Nginx + Let's Encrypt on Ubuntu VPS (AWS Lightsail)

## Key Decisions
- Keep everything as simple as possible — this is a small business tool, not an enterprise app
- Mobile-friendly (shop owner may use it on phone)

## Architecture Decisions

### Single Page App (no router)
- Everything lives on one screen with tabs/filters — no React Router
- Can add routing later if needed

### Backend (Bun + Express + SQLite)
- Backend lives in `server/` directory, frontend stays in `src/`
- Bun runtime with Express framework (familiar API) and built-in SQLite (`bun:sqlite`)
- SQLite is file-based — no separate database container needed
- `server/src/app.ts` exports the Express app (importable by tests), `server/src/index.ts` starts the server
- Frontend service layer (`src/services/orderService.ts`) calls REST API endpoints instead of localStorage
- In production, Bun serves the built React static files + API from a single container

### Service Layer Pattern
- Components NEVER call the API directly
- `orderService.ts` exposes async functions: `getAllOrders()`, `createOrder()`, `updateOrder()`, `deleteOrder()`
- These call the backend REST API (`/api/orders/...`)
- This decouples the UI from how data is fetched/stored

### State Management
- No state management library (no Redux, no Zustand)
- A single custom hook (`useOrders`) holds all app state and exposes actions
- `App.tsx` calls the hook, passes state down as props, callbacks up from children
- Standard React pattern: props down, callbacks up

### No Auth, No Real-time
- Authentication skipped for now — will add later if needed
- No real-time/live updates — manual refresh is fine for a single-user shop tool

### Test-Driven Backend
- Backend is built with TDD — tests written first, then implementation
- Uses `bun test` (zero config, Jest-compatible `describe`/`test`/`expect`)
- Tests use in-memory SQLite (`:memory:`) — fast, isolated, no cleanup between tests
- `server/src/app.ts` is separate from `server/src/index.ts` so tests can import the app without starting a server

## Data Model (Core)
- **orders** table: customer info, vendor, status, dates, notes
- Order statuses: `new` | `in_progress` | `at_vendor` | `ready` | `delivered` | `delayed` | `cancelled`

## Project Structure
```
src/                             # Frontend (React)
├── main.tsx
├── App.tsx
├── index.css
├── types/order.ts
├── services/orderService.ts     # Calls backend REST API
├── hooks/useOrders.ts
├── lib/constants.ts
├── lib/utils.ts
├── utils/orderUtils.ts
├── components/AppHeader.tsx
├── components/EmptyState.tsx
├── components/OrderDialog.tsx
├── components/OrderFilters.tsx
├── components/OrderForm.tsx
├── components/OrderRow.tsx
├── components/OrderStatusBadge.tsx
├── components/OrderTable.tsx
└── components/ui/               # shadcn components

server/                          # Backend (Bun + Express)
├── src/
│   ├── app.ts                   # Express app setup (importable by tests)
│   ├── index.ts                 # Server entry point (calls listen)
│   ├── routes/orders.ts         # CRUD API endpoints
│   └── db/
│       ├── database.ts          # SQLite connection + init
│       └── schema.sql           # Table definition
├── tests/
│   ├── setup.ts                 # Test helper: in-memory DB per test
│   └── orders.test.ts           # Endpoint tests (TDD)
├── package.json
└── tsconfig.json

Dockerfile                       # Multi-stage Docker build
docker-compose.yml               # Base Docker Compose config
docker-compose.prod.yml          # Production overrides (restart policy)
.dockerignore                    # Excludes from Docker build context
.env.example                     # Environment variable reference

deploy/                          # Deployment scripts
├── deploy.sh                    # Recurring deploy (git pull + docker build)
├── setup.sh                     # One-time VPS setup (Nginx + SSL)
└── nginx-order-tracker.conf     # Nginx reverse proxy template
```

## State Flow
`SQLite → Express API → orderService (fetch) → useOrders → App → children`

## Component Hierarchy
```
App
├── AppHeader
├── OrderFilters
├── OrderTable
│   ├── OrderRow  (× N)
│   │   └── OrderStatusBadge
│   └── EmptyState
└── OrderDialog
    └── OrderForm
```

## Key Files

**Frontend:**
- **`src/types/order.ts`** — `Order` interface, `OrderStatus` type, `OrderFormData` type (shared with backend)
- **`src/services/orderService.ts`** — async CRUD functions that call the backend REST API
- **`src/hooks/useOrders.ts`** — all app state + actions; the single hook `App.tsx` calls
- **`src/utils/orderUtils.ts`** — pure functions: filter, search, sort, count
- **`src/lib/constants.ts`** — status list, labels, badge colors
- **`src/App.tsx`** — root component; wires hook state to child components

**Backend:**
- **`server/src/app.ts`** — Express app setup (middleware, routes, static serving)
- **`server/src/index.ts`** — server entry point (imports app, calls listen)
- **`server/src/routes/orders.ts`** — all CRUD API endpoints
- **`server/src/db/database.ts`** — SQLite connection, migrations, WAL mode
- **`server/tests/orders.test.ts`** — endpoint tests (TDD)

## Documentation

| Path | Contents |
|------|----------|
| `.claude/docs/architecture.md` | Detailed file-by-file frontend architecture docs |
| `.claude/docs/deployment_infrastructure.md` | Deployment reference — Docker, Nginx, SSL, VPS setup, multi-app pattern |
| `.claude/plans/backend_plan.md` | Implementation plan for adding the Bun + Express backend — architecture, API design, TDD strategy, deployment, phases |

## Rules

### 1. Beginner Developer
- **Primary goal:** Get the app up and running
- **Secondary goal:** Help the developer learn TypeScript and React
- The developer is a newbie to React and TS (but decent in JS)
- Keep code **very simple and easy to understand** — no clever tricks
- **Document often:** Add clear comments explaining *why* something is done, especially React patterns (hooks, state, props) and TS concepts (types, interfaces, generics)
- When introducing a new React/TS concept, add a brief comment explaining what it does

### 2. Modular & Maintainable
- This project will be vibe coded — the developer will need to come in and fix things manually
- **One component = one file.** Keep components small and focused
- **One concern per file.** Separate types, utilities, API calls, and components
- Use clear, descriptive file and function names — no abbreviations
- Keep the folder structure flat and obvious — don't nest deeply
- Each module should be understandable in isolation without reading the whole codebase

### 3. General
- Prefer simplicity over abstraction
- Use shadcn/ui components wherever possible instead of building custom ones
- Tailwind for all styling — no separate CSS files
- **Keep all business logic in pure functions separate from React components. No business logic inside components — components only handle rendering and user interaction.**

## Commands
```bash
# Root (runs both frontend + backend)
npm run dev              # Start frontend (Vite) + backend (Bun) concurrently
npm run build            # Build frontend + backend for production

# Frontend only
npm run dev:frontend     # Vite dev server (port 5173)
npm run build:frontend   # Production build → dist/

# Backend only
npm run dev:server       # Bun with --watch (port 3001)
cd server && bun test    # Run backend tests
cd server && bun test --watch  # TDD mode — re-run on file changes

# Docker (local)
docker compose up --build              # Build and run locally (port 3001)
docker compose down                    # Stop containers

# Deployment (on VPS)
./deploy/setup.sh <domain>             # One-time: register Nginx + SSL
./deploy/deploy.sh                     # Recurring: pull, build, start
```
