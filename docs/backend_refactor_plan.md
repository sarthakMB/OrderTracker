---
cssclasses:
  - study
---

# Backend Refactor Plan (PRD-aligned)

Last reviewed: 2026-02-15  
Sources: `docs/PRD.md`, `.claude/docs/other_project_architectural_patterns.md`

## 1) Why this refactor
The current backend is a single `orders` table with routes that talk directly to SQLite. The PRD now requires:
- A richer domain model: **Orders, Customers, Vendors, Product Types, Users**
- **AuthN/AuthZ (RBAC)**: `OWNER` vs `EMPLOYEE`
- **Soft deletes everywhere** (`is_deleted`)
- An immutable, append-only **Order Ledger** (`order_ledger_entries`) for full audit history
- “Delayed” as a **computed state**, not a stored status

This plan proposes a new backend architecture and a safe migration path from the current schema.

---

## 2) Target architecture (layered, DI-friendly)

### 2.1 Request flow
```
HTTP Request → middleware → route/controller → service → repository → SQLite
```

### 2.2 Responsibilities by layer
- **Routes/Controllers** (`server/src/routes/`):
  - Parse HTTP (params/body/query)
  - Call a service method
  - Map service errors → HTTP status + response shape
  - No SQL; minimal business logic

- **Services** (`server/src/services/`):
  - Business logic and invariants (RBAC rules, workflow rules, computed fields)
  - Transactions: “insert ledger entry + update order projection” as one unit
  - Calls repositories only (no direct DB calls)

- **Repositories** (`server/src/repositories/`):
  - Data access only (SQL + mapping DB rows → domain objects)
  - No cross-entity business rules
  - No HTTP concerns

- **DB** (`server/src/db/`):
  - SQLite connection factory
  - Migration runner
  - Schema SQL migrations

### 2.3 Dependency injection (simple container)
Create a small “composition root” to wire dependencies once:
- `createDatabase(...)`
- `createRepositories(db)`
- `createServices(repos)`
- `createApp({ services, middlewares })`

This keeps tests easy: they can instantiate an in-memory DB and a full app stack per test.

### 2.4 Proposed backend folder structure
```
server/src/
  app.ts
  index.ts
  container.ts                 # creates db + repos + services, passes into app
  db/
    database.ts                # connection + pragmas
    migrate.ts                 # migration runner
    migrations/                # ordered .sql files
  domain/
    order.ts                   # domain types + status enum
    user.ts
    errors.ts                  # error codes used across layers
  middlewares/
    auth.ts                    # requireAuth, requireRole
  repositories/
    ordersRepository.ts
    customersRepository.ts
    vendorsRepository.ts
    productTypesRepository.ts
    usersRepository.ts
    orderLedgerRepository.ts
  services/
    ordersService.ts
    customersService.ts
    vendorsService.ts
    productTypesService.ts
    authService.ts
  routes/
    orders.ts
    customers.ts
    vendors.ts
    productTypes.ts
    auth.ts
    users.ts                   # owner-only admin endpoints
```

---

## 3) Database refactor plan

### 3.1 Keep SQLite (initially)
Unless you want to switch to Postgres now, we can keep SQLite for MVP:
- Lowest ops overhead (single file DB)
- Works well for the scale (500+ orders/month)
- Bun has first-class SQLite support (`bun:sqlite`)

If you *do* want Postgres later, the repository layer makes that swap far easier.

### 3.2 Migrations (required)
Current approach “create table on startup” won’t scale to multi-table + safe evolution.

Plan:
- Add a `schema_migrations` table
- Create a migration runner that applies `server/src/db/migrations/*.sql` in order
- Run migrations at startup (fail-fast), and also via an explicit script for CI/deploy

### 3.3 Target schema (PRD mapping)
Tables (MVP):
- `users`
- `customers`
- `vendors`
- `product_types`
- `orders` (current-state projection)
- `order_ledger_entries` (append-only history)
- `schema_migrations`

Cross-cutting columns:
- `is_deleted` on all business tables (and usually `deleted_at`)
- `is_test` on all business tables
- `created_at`, `updated_at` where applicable

#### `orders` (projection)
Stores “current state” for fast lists/filters/sorts.
Must be derivable from ledger events over time.

Key columns (from PRD):
- identifiers: `id`, `order_number` (optional)
- customer: `customer_id` (nullable) and/or `customer_name` (for ad-hoc one-offs)
- product: `product_type_id`
- text: `title`/`description`, `notes`
- workflow: `status`, optional `process_stage`, optional `current_vendor_id`
- dates: `received_date`, `promised_date`, optional `internal_due_date`, optional `delivered_at`
- system: `created_at`, `updated_at`, `is_deleted`, `is_test`

Computed (not stored):
- `is_delayed`, `days_delayed`, `display_status`

#### `order_ledger_entries` (append-only)
Every write action inserts exactly one ledger entry:
- `id`
- `order_id`
- `actor_user_id`
- `event_type`
- `occurred_at`
- `summary` (optional)
- `payload` (JSON: field-level changes, reason, etc.)
- `is_deleted`, `is_test` (soft delete still supported, but prefer “never delete” in practice)

##### Ledger immutability enforcement
SQLite can enforce “no UPDATE/DELETE” via triggers:
- `BEFORE UPDATE ON order_ledger_entries` → `RAISE(ABORT, ...)`
- `BEFORE DELETE ON order_ledger_entries` → `RAISE(ABORT, ...)`

Even if we also enforce this at the repository layer, triggers protect against accidental writes.

#### Master data
- `vendors.active` and `product_types.active` (deactivate instead of delete)
- `customers` can be soft-deleted, but MVP may prefer “inactive” rather than delete

### 3.4 Indexing plan (performance + UX)
Create indexes that match list/filter/sort requirements:
- Orders:
  - `status`
  - `promised_date`
  - `current_vendor_id`
  - `product_type_id`
  - `customer_id` (and maybe `customer_name` for ad-hoc search)
  - `updated_at`
- Ledger:
  - `(order_id, occurred_at)`

### 3.5 Data migration from current `orders` table
Current schema: `customerName`, `customerContact`, `orderDescription`, `vendorName`, `status`, `notes`, `createdAt`, `updatedAt`.

Migration approach (safe + reversible):
1. Add new tables via migrations (do not drop old `orders` yet).
2. Run a one-time migration that:
   - Creates `product_types` with at least one default: `Unknown`
   - Creates `vendors` by distinct `vendorName`
   - Creates `customers` by distinct `(customerName, customerContact?)`
   - Creates new `orders` rows (projection) with mapped fields
   - Creates a single initial `ORDER_CREATED` ledger entry per migrated order
3. Swap the API to use the new schema.
4. Keep legacy table for one release, then drop it in a later migration (optional).

Open migration issues to decide now:
- What do we set for `promised_date` on legacy orders (required for delay calculation)?
- Do we backfill `received_date` from `createdAt` date-only?

---

## 4) API refactor plan (PRD-driven)

### 4.1 Orders
Endpoints (suggested):
- `GET /api/orders` (filters: status, vendor, product type, customer, delayed-only, due-date range; search by customer/order_number/title)
- `GET /api/orders/:id`
- `POST /api/orders`
- `PATCH /api/orders/:id` (general edits)
- `POST /api/orders/:id/status` (explicit status change)
- `POST /api/orders/:id/vendor` (assign/clear vendor)
- `POST /api/orders/:id/deliver` (sets `delivered_at`)
- `POST /api/orders/:id/cancel` (sets status cancelled + optional reason)
- `GET /api/orders/:id/ledger` (timeline)

Rule: every write inserts exactly one `order_ledger_entries` row with `actor_user_id`.

### 4.2 Master data
Endpoints (suggested):
- `GET/POST/PATCH /api/vendors` (+ deactivate/reactivate)
- `GET/POST/PATCH /api/product-types` (+ deactivate/reactivate)
- `GET/POST/PATCH /api/customers`

### 4.3 Auth + users (RBAC)
Endpoints (suggested):
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/POST/PATCH /api/users` (OWNER-only for employee management)

Middleware:
- `requireAuth`
- `requireRole('OWNER')`

---

## 5) Service design (how invariants are enforced)

### 5.1 Core service invariant: ledger + projection in one transaction
For any order mutation:
1. Load current order projection
2. Validate permissions and workflow rules
3. Start transaction
4. Insert 1 ledger entry describing the change
5. Update projection row (`orders`)
6. Commit

If any step fails, rollback so ledger and projection never diverge.

### 5.2 OrderService surface area (suggested)
- `listOrders(filters, search, sort)`
- `getOrder(orderId)`
- `createOrder(input, actorUser)`
- `updateOrder(orderId, patch, actorUser)` (field changes)
- `changeStatus(orderId, status, actorUser)`
- `assignVendor(orderId, vendorId | null, actorUser)`
- `markDelivered(orderId, deliveredAt?, actorUser)`
- `cancelOrder(orderId, reason?, actorUser)`
- `softDeleteOrder(orderId, actorUser)` / `restoreOrder(orderId, actorUser)`
- `getLedger(orderId)`

---

## 6) Testing & validation plan

### 6.1 Keep current testing style
Continue with `bun test` integration tests using in-memory SQLite.

### 6.2 Add tests for PRD requirements
- Auth:
  - login success/failure
  - RBAC: EMPLOYEE blocked from OWNER-only endpoints
- Ledger:
  - every write produces exactly one ledger row
  - ledger rows cannot be updated/deleted (trigger test)
- Orders:
  - delayed computation: `today > promised_date` and `status not in (DELIVERED, CANCELLED)`
  - list sorting: “most delayed first”, then due date, then updated
- Master data:
  - deactivate vendor/product type keeps historical orders intact

---

## 7) Refactor phases (incremental, shippable)

### Phase 0 — Decisions + agreement (no code)
- Confirm the DB engine and auth approach
- Confirm naming conventions and date handling
- Confirm migration/backfill behavior for legacy orders

### Phase 1 — Database foundation
- Add migration runner + `schema_migrations`
- Create new schema tables + indexes
- Add seed rows (e.g., `Unknown` product type)

### Phase 2 — Introduce new architecture layers
- Create repositories (no route changes yet)
- Create services using repositories
- Keep the old routes temporarily calling old DB until services are ready

### Phase 3 — Swap API to new schema
- Refactor order routes to call `OrderService`
- Add ledger endpoint and ensure ledger is written on mutations
- Add master data routes (vendors/product types/customers)

### Phase 4 — Auth + RBAC
- Add users table + auth routes
- Add auth middleware to protect all endpoints
- Add OWNER-only endpoints for user management + master data restrictions

### Phase 5 — Cleanup + hardening
- Remove legacy routes/schema if no longer needed
- Add backup/export approach (even a simple DB file export)
- Review error handling consistency and logs

---

## 8) Key open decisions (please answer)

1) **Database**: keep SQLite for MVP, or switch to Postgres now?

2) **ID format**:
   - `uuid` (simple, already used in current routes via `crypto.randomUUID()`)
   - prefixed readable IDs (like `O123...`, `U123...`) as in your other project

3) **Column naming**:
   - Keep **camelCase** in SQLite (like current `orders` table)
   - Switch to **snake_case** (more conventional SQL), mapping in repositories

4) **Auth mechanism**:
   - Cookie + server sessions (Express session-style)
   - JWT in HttpOnly cookie (stateless)

5) **Password hashing**: OK to use `bcrypt` (recommended) or do you want `argon2`?

6) **Dates/timezones**:
   - Store due dates as **date-only** (`YYYY-MM-DD`) and compute delay in local time
   - Store everything as full ISO timestamps and derive date-only as needed

7) **Legacy migration backfill**:
   - Should `promised_date` be required for all orders going forward?
   - For existing orders, do we set `promised_date = received_date`, leave it NULL, or set a fixed placeholder and force edit?

8) **Order status set**:
   - PRD MVP statuses: `NEW`, `IN_PROGRESS`, `READY`, `DELIVERED`, `CANCELLED` (delay computed)
   - Current code also has `at_vendor` and `delayed`. Do you want to remove those fully?

9) **One-off customers**:
   - Do you want to allow `customer_name` directly on the order (no `customer_id`) as PRD suggests?
   - Or always create/select a customer record?

10) **Ledger payload style**:
   - Store only “diffs” (`changes: { field: {from,to} }`) (recommended)
   - Store full snapshots (bigger, but easier to debug)

If you answer these, I can convert this plan into a concrete implementation plan with specific migration file names, endpoint contracts, and an execution sequence that minimizes downtime.

