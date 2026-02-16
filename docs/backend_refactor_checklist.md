---
cssclasses:
  - study
---

# Backend Refactor — Implementation Checklist

Reference: `docs/backend_refactor_plan.md`, `docs/PRD.md`
Created: 2026-02-16

---

## Phase 1 — Database foundation

### Migration system
- [x] Create `server/src/db/migrate.ts` — migration runner that reads `migrations/*.sql` in order
- [x] Create `schema_migrations` table (tracks which migrations have run)
- [x] Wire migration runner to run at startup in `database.ts` (fail-fast)
- [x] Replace old `schema.sql` / `CREATE TABLE IF NOT EXISTS` approach entirely

### Schema migrations (fresh start — no legacy data to migrate)
- [x] `001_create_customers.sql` — `id`, `name`, `phone`, `notes`, `is_deleted`, `is_test`, `created_at`, `updated_at`
- [x] `002_create_vendors.sql` — `id`, `name`, `service_type`, `phone`, `notes`, `active`, `is_deleted`, `is_test`, `created_at`, `updated_at`
- [x] `003_create_product_types.sql` — `id`, `name`, `properties` (JSON), `active`, `is_deleted`, `is_test`, `created_at`, `updated_at`
- [x] `004_create_users.sql` — `id`, `name`, `role`, `phone`, `password_hash`, `active`, `token_revoked_before`, `is_deleted`, `is_test`, `created_at`, `updated_at`, `last_login_at`
- [x] `005_create_orders.sql` — `id`, `order_number`, `customer_id`, `product_type_id`, `title`, `description`, `quantity`, `status`, `process_stage`, `current_vendor_id`, `received_date`, `promised_date`, `internal_due_date`, `delivered_at`, `notes`, `is_deleted`, `is_test`, `created_at`, `updated_at`
- [x] `006_create_order_ledger_entries.sql` — `id`, `order_id`, `actor_user_id`, `event_type`, `occurred_at`, `summary`, `payload` (JSON), `is_deleted`, `is_test`
- [x] `007_create_indexes.sql` — indexes on `orders` (`status`, `promised_date`, `current_vendor_id`, `product_type_id`, `customer_id`, `updated_at`), index on `order_ledger_entries` (`order_id`, `occurred_at`)
- [x] `008_ledger_immutability_triggers.sql` — `BEFORE UPDATE` and `BEFORE DELETE` triggers on `order_ledger_entries` that `RAISE(ABORT)`
- [x] `009_seed_product_types.sql` — insert `Cartons`, `Labels`, `Leaflets`
- [x] Delete old `server/src/db/schema.sql`

### ID generation
- [x] Create ID generator utility — prefixed readable IDs (`O-...`, `C-...`, `V-...`, `U-...`, `PT-...`, `LE-...`)

### Order number generation
- [x] Create `order_number` generator — format `YYMM-NNNN` (e.g., `2602-0001`)
- [x] Query max existing order_number for current YYMM to determine next sequence

### Test setup
- [x] Rewrite `server/tests/setup.ts` — `createTestDb()` returns `{ db, cleanup }` wired with in-memory SQLite (no HTTP server needed yet)
- [x] `cleanup()` just closes the DB

### Tests (bun test)
- [x] Test: migration runner applies migrations in order
- [x] Test: migration runner skips already-applied migrations
- [x] Test: all tables created with correct columns
- [x] Test: ledger immutability triggers block UPDATE and DELETE

---

## Phase 2 — Architecture layers

### Domain types (`server/src/domain/`)
- [ ] `order.ts` — `Order` interface, `OrderStatus` enum (`NEW`, `IN_PROGRESS`, `READY`, `DELIVERED`, `CANCELLED`), `OrderFormData`, `EventType` enum
- [ ] `user.ts` — `User` interface, `UserRole` enum (`OWNER`, `EMPLOYEE`)
- [ ] `errors.ts` — error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `UNAUTHORIZED`, `CONFLICT`; `AppError` class with `code` + `message` + `httpStatus`

### Repositories (`server/src/repositories/`)
- [ ] Base convention: all SELECTs include `WHERE is_deleted = 0` by default; `includeDeleted` option
- [ ] `customersRepository.ts` — `findAll`, `findById`, `create`, `update`, `softDelete`
- [ ] `vendorsRepository.ts` — `findAll`, `findById`, `create`, `update`, `deactivate`, `reactivate`
- [ ] `productTypesRepository.ts` — `findAll`, `findById`, `create`, `update`, `deactivate`, `reactivate`
- [ ] `ordersRepository.ts` — `findAll` (with filters, cursor pagination, sorting), `findById`, `create`, `update`, `softDelete`
- [ ] `orderLedgerRepository.ts` — `insert`, `findByOrderId` (no update/delete methods)
- [ ] `usersRepository.ts` — `findAll`, `findById`, `findByPhone`, `create`, `update`, `softDelete`
- [ ] All repositories map snake_case DB columns ↔ camelCase domain objects

### Services (`server/src/services/`)
- [ ] `customersService.ts` — CRUD + validation
- [ ] `vendorsService.ts` — CRUD + deactivate/reactivate + validation
- [ ] `productTypesService.ts` — CRUD + deactivate/reactivate + validation
- [ ] `ordersService.ts`:
  - [ ] `listOrders(filters, search, sort, cursor)` — with computed `is_delayed` / `days_delayed`
  - [ ] `getOrder(orderId)` — with computed delay fields
  - [ ] `createOrder(input, actorUser)` — transaction: insert order + insert `ORDER_CREATED` ledger entry
  - [ ] `updateOrder(orderId, patch, actorUser)` — transaction: update projection + insert `ORDER_UPDATED` ledger entry (diff payload)
  - [ ] `changeStatus(orderId, status, actorUser)` — transaction: update + `STATUS_CHANGED` ledger
  - [ ] `assignVendor(orderId, vendorId | null, actorUser)` — transaction: update + `VENDOR_CHANGED` ledger
  - [ ] `markDelivered(orderId, actorUser)` — set `delivered_at` + status `DELIVERED` + `DELIVERED_MARKED` ledger
  - [ ] `cancelOrder(orderId, reason?, actorUser)` — status `CANCELLED` + `CANCELLED_MARKED` ledger
  - [ ] `softDeleteOrder(orderId, actorUser)` / `restoreOrder(orderId, actorUser)` + ledger entries
  - [ ] `getLedger(orderId)` — return ledger entries sorted by `occurred_at`
- [ ] `authService.ts` — `login(phone, password)`, `verifyToken(token)`, `hashPassword`, `createUser`

### Bootstrap (`server/src/bootstrap.ts`)
- [ ] `createDatabase(path)` → db
- [ ] `createRepositories(db)` → repos
- [ ] `createServices(repos)` → services
- [ ] Wire into `createApp({ services })`

### Test factories (`server/tests/factory.ts`)
- [ ] `factory.customer(overrides?)` — creates a customer via repo, returns it
- [ ] `factory.vendor(overrides?)` — creates a vendor via repo, returns it
- [ ] `factory.productType(overrides?)` — creates a product type via repo, returns it
- [ ] `factory.user(overrides?)` — creates a user via repo, returns it
- [ ] `factory.order(overrides?)` — creates an order (auto-creates required customer + product type if not provided), returns it
- [ ] Each factory uses sensible defaults so tests only specify what they care about

### Tests (bun test — unit + integration, no HTTP)
- [ ] Test: each repository CRUD works with in-memory DB
- [ ] Test: soft-delete filtering — deleted records excluded by default
- [ ] Test: order service creates ledger entry on every mutation
- [ ] Test: order service computes `is_delayed` / `days_delayed` correctly
- [ ] Test: `AppError` has correct `code` and `httpStatus`

---

## Phase 3 — Swap API to new schema

### Routes (`server/src/routes/`)
- [ ] `orders.ts` — rewrite to call `ordersService` instead of direct DB
  - [ ] `GET /api/orders` — cursor-based pagination, filters, search, sorting
  - [ ] `GET /api/orders/:id` — single order with computed delay
  - [ ] `POST /api/orders` — create (validate required fields: `customer_id`, `product_type_id`, `title`, `promised_date`)
  - [ ] `PATCH /api/orders/:id` — general field edits
  - [ ] `POST /api/orders/:id/status` — status change
  - [ ] `POST /api/orders/:id/vendor` — assign/clear vendor
  - [ ] `POST /api/orders/:id/deliver` — mark delivered
  - [ ] `POST /api/orders/:id/cancel` — cancel with optional reason
  - [ ] `GET /api/orders/:id/ledger` — order timeline
- [ ] `customers.ts`:
  - [ ] `GET /api/customers` — list (with search)
  - [ ] `POST /api/customers` — create
  - [ ] `PATCH /api/customers/:id` — update
- [ ] `vendors.ts`:
  - [ ] `GET /api/vendors` — list
  - [ ] `POST /api/vendors` — create
  - [ ] `PATCH /api/vendors/:id` — update
  - [ ] `POST /api/vendors/:id/deactivate` / `POST /api/vendors/:id/reactivate`
- [ ] `productTypes.ts`:
  - [ ] `GET /api/product-types` — list
  - [ ] `POST /api/product-types` — create
  - [ ] `PATCH /api/product-types/:id` — update
  - [ ] `POST /api/product-types/:id/deactivate` / `POST /api/product-types/:id/reactivate`

### Response envelope
- [ ] All routes return `{ success: true, data }` on success
- [ ] All routes return `{ success: false, error: { code, message } }` on failure
- [ ] Add error-handling middleware that catches `AppError` and maps to response

### Wire routes into app
- [ ] Update `app.ts` to mount new routes
- [ ] Delete old `server/src/routes/orders.ts`
- [ ] Delete old `server/tests/orders.test.ts`

### HTTP tests (supertest)
- [ ] `bun add -d supertest @types/supertest`
- [ ] Update `server/tests/setup.ts` — add `createTestHttpApp()` that returns supertest `request(app)` agent
- [ ] Test: all order CRUD endpoints work end-to-end
- [ ] Test: cursor pagination returns correct pages
- [ ] Test: filters (status, vendor, product type, customer, delayed-only, date range)
- [ ] Test: search by customer name, order number, title
- [ ] Test: sort order — most delayed first, then due date, then updated
- [ ] Test: every write endpoint produces exactly one ledger entry
- [ ] Test: master data CRUD (vendors, product types, customers)
- [ ] Test: error responses match envelope format

---

## Phase 4 — Auth + RBAC

### Auth routes (`server/src/routes/auth.ts`)
- [ ] `POST /api/auth/login` — validate phone + password, return JWT in HttpOnly cookie (~1 year expiry)
- [ ] `POST /api/auth/logout` — clear cookie
- [ ] `GET /api/auth/me` — return current user from JWT

### User management routes (`server/src/routes/users.ts`)
- [ ] `GET /api/users` — OWNER-only, list all users
- [ ] `POST /api/users` — OWNER-only, create employee
- [ ] `PATCH /api/users/:id` — OWNER-only, update user (role, active, etc.)

### Auth middleware (`server/src/middlewares/auth.ts`)
- [ ] `requireAuth` — extract JWT from cookie, verify signature, look up user from DB (get current role + check `jwt.iat >= user.token_revoked_before`), attach full user to `req`
- [ ] `requireRole('OWNER')` — check `req.user.role`

### Protect all endpoints
- [ ] Add `requireAuth` to all API routes
- [ ] Add `requireRole('OWNER')` to: user management, vendor/product-type deactivate/reactivate
- [ ] Ensure `actor_user_id` from `req.user` is passed to all service mutations

### Bootstrap first OWNER
- [ ] Create seed script (`server/src/db/seed-owner.ts` or migration) to insert first OWNER user with hashed password

### Tests (bun test — service level)
- [ ] Test: authService.login success returns valid JWT
- [ ] Test: authService.login failure throws UNAUTHORIZED
- [ ] Test: authService.verifyToken rejects revoked tokens (`iat < token_revoked_before`)

### Tests (supertest — HTTP level)
- [ ] Test: `POST /api/auth/login` success → JWT cookie set
- [ ] Test: `POST /api/auth/login` failure → 401
- [ ] Test: unauthenticated request → 401
- [ ] Test: expired/revoked token → 401
- [ ] Test: EMPLOYEE cannot access OWNER-only endpoints → 403
- [ ] Test: EMPLOYEE can create/edit orders and customers
- [ ] Test: all mutations record correct `actor_user_id` in ledger

---

## Phase 5 — Cleanup + hardening

- [ ] Review all error responses for consistency
- [ ] Add request logging (method, path, status, duration)
- [ ] Add DB backup approach (e.g., copy SQLite file on schedule)
- [ ] Flag frontend work needed:
  - [ ] Product type dropdown on order form
  - [ ] Vendor dropdown by ID (not free text)
  - [ ] Due date / promised date fields
  - [ ] Process stage dropdown + "Other"
  - [ ] Order number display
  - [ ] Delay badge (computed)
  - [ ] Order timeline view (ledger)
  - [ ] Login screen
  - [ ] User management screen (OWNER only)
