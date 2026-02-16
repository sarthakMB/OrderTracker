---
cssclasses:
  - study
---

# Backend Refactor Plan (PRD-aligned)

Last reviewed: 2026-02-16
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
  bootstrap.ts                 # creates db + repos + services, passes into app
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

### 3.1 Keep SQLite 
- Lowest ops overhead (single file DB)
- Works well for the scale (500+ orders/month)
- Bun has first-class SQLite support (`bun:sqlite`)
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
- identifiers: `id`, `order_number` (date-prefixed auto-generated: `YYMM-NNNN`, e.g., `2602-0001`)
- customer: `customer_id` (always required — no anonymous orders)
- product: `product_type_id`
- workflow: `status` (`NEW`, `IN_PROGRESS`, `READY`, `DELIVERED`, `CANCELLED`), optional `process_stage` (free text), optional `current_vendor_id`. All derived from ledger, stored on projection for fast queries.
- text: `title`, `description`/`notes`, `quantity` (optional)
- dates: `received_date`, `promised_date` (required), optional `internal_due_date`, optional `delivered_at` — all stored as full ISO timestamps
- system: `created_at`, `updated_at`, `is_deleted`, `is_test`

Computed (not stored):
- `is_delayed`, `days_delayed`, `display_status`

Note: `at_vendor` and `delayed` are **not** valid statuses. `DELAYED` is computed only. `at_vendor` is replaced by `IN_PROGRESS` + `current_vendor_id`.

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

### 3.5 Data migration
**Not needed.** No production users or data exist on the old schema. The old `orders` table and `schema.sql` will be deleted and replaced entirely by the new migration-based schema. Clean start.

---
 
## 4) API refactor plan (PRD-driven)

### 4.1 Orders
Endpoints (suggested):
- `GET /api/orders` (cursor-based pagination; filters: status, vendor, product type, customer, delayed-only, due-date range; search by customer/order_number/title)
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
- `POST /api/auth/login` — returns JWT in HttpOnly cookie (long expiry, ~1 year)
- `POST /api/auth/logout` — clears cookie
- `GET /api/auth/me` — returns current user from JWT
- `GET/POST/PATCH /api/users` (OWNER-only for employee management)

Auth mechanism (decided):
- **JWT in HttpOnly cookie**, long expiry (~1 year). Device-based auth — login once per device, stay logged in.
- **Password hashing:** `Bun.password.hash()` (built-in, zero external deps).
- **Revocation:** `token_revoked_before` timestamp column on `users` table. Auth middleware checks `jwt.iat < user.token_revoked_before` → reject. Force-logout is per-user (not per-device), sufficient for MVP with ~10 trusted devices.
- **JWT payload:** `{ user_id, device_name? }` — identity only. Role is NOT stored in JWT; it is read from `users` table on every request so role changes take effect immediately.
- **Bootstrap:** First OWNER user registered manually via backend (seed script or direct DB insert).

Middleware:
- `requireAuth` — validates JWT, looks up user from DB (gets current role, checks `token_revoked_before`), attaches user to request
- `requireRole('OWNER')`

### 4.4 API response envelope & error codes
All endpoints use a consistent response shape:
```json
{ "success": true, "data": ... }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Order not found" } }
```

Standard error codes (defined in `domain/errors.ts`):
- `VALIDATION_ERROR` — invalid input (400)
- `NOT_FOUND` — entity doesn't exist (404)
- `FORBIDDEN` — insufficient role/permissions (403)
- `UNAUTHORIZED` — not logged in / invalid token (401)
- `CONFLICT` — e.g., duplicate customer name (409)

### 4.5 Soft-delete convention
Every repository `SELECT` filters `WHERE is_deleted = 0` by default. Repositories expose an explicit `includeDeleted` option for admin/debug queries. This is enforced at the repository layer, not per-query in services/routes.

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

### Phase 0 — Decisions + agreement (no code) ✅ DONE
All decisions resolved (2026-02-16). See §8 for full list.

### Phase 1 — Database foundation
- Add migration runner + `schema_migrations`
- Create new schema tables + indexes (snake_case columns, prefixed IDs)
- Delete old `schema.sql` and legacy `orders` table code
- Add seed data: product types (Cartons, Labels, Leaflets)
- Add `order_number` auto-generation logic (format: `YYMM-NNNN`)
- Process stages stored as app-level constants (Design, Plate, Printing, Lamination)

### Phase 2 — Introduce new architecture layers
- Define domain types and error codes (`domain/errors.ts`)
- Create repositories with soft-delete filtering convention (`WHERE is_deleted = 0` by default)
- Create services using repositories

### Phase 3 — Build new API
- Write order routes calling `OrderService`
- Add cursor-based pagination to `GET /api/orders`
- Add ledger endpoint and ensure ledger is written on mutations
- Add master data routes (vendors/product types/customers)
- Ensure consistent response envelope (`{ success, data }` / `{ success, error: { code, message } }`)

### Phase 4 — Auth + RBAC
- Add users table + `token_revoked_before` column
- Add auth routes (login → JWT in HttpOnly cookie, long expiry)
- Add auth middleware (`requireAuth` with revocation check, `requireRole`)
- Bootstrap first OWNER user via seed script
- Add OWNER-only endpoints for user management + master data restrictions

### Phase 5 — Hardening
- Add backup/export approach (even a simple DB file export)
- Review error handling consistency and logs
- Add request logging (method, path, status, duration)
- Frontend changes flagged: new fields (product type dropdown, vendor dropdown by ID, due dates, process stage, order number) need UI updates

---

## 8) Key decisions (all resolved — 2026-02-16)

| # | Decision | Answer |
|---|----------|--------|
| 1 | **Database** | Keep SQLite for MVP |
| 2 | **ID format** | Prefixed readable IDs (`O-...`, `U-...`, `C-...`) |
| 3 | **Column naming** | snake_case in DB, mapped in repositories |
| 4 | **Auth mechanism** | JWT in HttpOnly cookie, long expiry (~1 year). Device-based auth. `token_revoked_before` for revocation. JWT stores `user_id` only — role read from DB on each request. |
| 5 | **Password hashing** | `Bun.password` (built-in, zero deps) |
| 6 | **Dates/timezones** | All ISO timestamps (business dates and system timestamps alike) |
| 7 | **Legacy backfill** | `promised_date = received_date`; `received_date` from `createdAt`. `promised_date` required going forward. |
| 8 | **Status set** | `NEW`, `IN_PROGRESS`, `READY`, `DELIVERED`, `CANCELLED`. `DELAYED` is computed only (not stored). `at_vendor` removed. |
| 9 | **One-off customers** | No. Always create a customer record. |
| 10 | **Ledger payload** | Diffs only: `{ field: { from, to } }` |
| 11 | **Order number** | Date-prefixed auto-generated: `YYMM-NNNN` (e.g., `2602-0001`) |
| 12 | **Pagination** | Cursor-based from day one |
| 13 | **Process stage** | Dropdown with predefined options + "Other" free text. Stored as free text on order. |
| 14 | **Seed user** | First OWNER registered manually via backend |

