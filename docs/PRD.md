---
cssclasses:
  - study
---

# Order Tracker (Printing Shop) — Product Requirements Document (PRD)

## 0) Document control
- **Product:** Order Tracker (for a small/medium printing shop)
- **Primary user:** Shop owner + shop employees
- **Purpose of this PRD:** Give an AI agent a clear “why/what/how” to build and evolve the app.
- **Status:** Draft
- **Owner:** (You)
- **Last updated:** 2026-02-16

### Version history (product)
| Product version | Date | Summary |
|---|---:|---|
| v0.1 (MVP) | TBD | Order creation + tracking + vendors/customers + delay visibility + product type dropdown |

> Rule: update this table for every user-visible release and keep “Scope” aligned with what is actually shipped.

---

## 1) Problem statement
A printing shop processes **500+ orders/month**. Tracking each order’s current stage, whether it is delayed, and by how many days is hard with manual methods (paper/WhatsApp/Excel). This causes missed deadlines, lack of visibility, and time wasted answering “where is my order?”.

## 2) Goals
1. **Make order status instantly visible** (where is it in the pipeline, who has it right now).
2. **Identify delays automatically** (which orders are delayed, delayed by how many days).
3. Keep data entry **fast and simple** (dropdowns for small sets like vendors and product types).
4. Support **repeat customers** and **one-off customers** without friction.

## 3) Non-goals (for MVP)
- Quotation generation
- Billing/invoicing
- Inventory/accounting
- Multi-shop / multi-tenant support
- Enterprise SSO / complex IAM (basic RBAC is required for MVP; see §6.5)

## 4) Users & personas
- **Owner (Dad):** wants visibility + simple updates; minimal typing.
- **Employee (Operator):** creates orders, updates stages/vendors, checks what’s due today/this week.

## 5) Core concepts (domain model)
### 5.1 Order (current-state projection)
Represents a single customer job. The “current” fields (status/vendor/dates/etc.) may be stored for fast querying, but must be derivable from the Order Ledger (§5.5).

Minimum fields (MVP):
- `id` (unique)
- `order_number` (human-friendly, date-prefixed auto-generated; format: `YYMM-NNNN`, e.g., `2602-0001`)
- `customer_id` 
- `product_type_id`
- `title` / `description` (free text)
- `quantity` (optional)
- `status` (pipeline stage; see §6.1)
- `process_stage` (optional; extra detail while `IN_PROGRESS`, e.g., "Design", "Plate", "Printing", "Lamination"). UX: dropdown with predefined options + "Other" free text input. Stored as free text on the order.
- `current_vendor_id` (nullable; can be set while `IN_PROGRESS` if work is outsourced)
- `created_at`
- `received_date` (date order was received; default = `created_at` date)
- `promised_date` (estimated/promised completion date shown as “Due date”; **delay is calculated from this**)
- `internal_due_date` (optional; internal target date if different from `promised_date`)
- `delivered_at` (nullable; set when completed)
- `notes` (optional)
- `is_deleted` : All things should be soft deleted
- `is_test` : bool; self explanatory (for testing)

Derived fields:
- `is_delayed`: `today > promised_date` AND `status != DELIVERED/CANCELLED`
- `days_delayed`: `max(0, today - promised_date)` (in whole days) under the same condition
- `display_status` (optional UI concept): if `is_delayed` then show “DELAYED” badge regardless of `status`

### 5.2 Customer
Supports frequent customers and one-offs.

Minimum fields (MVP):
- `id`
- `name` (unique-ish; allow duplicates if needed but prefer uniqueness)
- `phone` (optional)
- `notes` (optional)
- `is_deleted` : All things should be soft deleted
- `is_test` : bool; self explanatory (for testing)

UX rule:
- Order creation should allow **search existing customers** and **create new quickly**.
- **Always create a customer record** — no anonymous/one-off orders without a `customer_id`.

### 5.3 Vendor
Small set (5–10 typical). Used as dropdown.

Minimum fields (MVP):
- `id`
- `name`
- `service_type` (optional; e.g., lamination, die-cut, binding)
- `phone` (optional)
- `notes` (optional)
- `active` (boolean)
- `is_deleted` : All things should be soft deleted
- `is_test` : bool; self explanatory (for testing)
### 5.4 Product type (NEW requirement)
Small set (cartons, labels, leaflets, …). Used as dropdown on Order creation/edit.

Minimum fields (MVP):
- `id`
- `name` (e.g., Cartons, Labels, Leaflets)
- `properties` : json (things could be specific to product type)
- `active` (boolean)

Seed data (initial suggestion):
- Cartons
- Labels
- Leaflets

### 5.5 Order ledger (NEW requirement: full history / audit log)
Every create/edit/status change must be stored as an **append-only** entry so the full lifecycle is reconstructable.

Recommended name:
- Product concept name: **Order Ledger**
- Table/collection name: `order_ledger_entries` (alternatives: `order_events`, `order_activity_log`)

Key rules:
- **Never update** an existing ledger entry. Only insert new entries.
- Every user action that changes an order (including edits) creates **exactly one** ledger entry.
- The current state (status/vendor/dates/etc.) must be **derivable by replaying** ledger entries in time order.
- For performance, the app may also maintain a **current-state projection** (e.g., the `orders` row) updated in the same transaction as the ledger insert; if needed, it can be rebuilt from the ledger.

Minimum fields (MVP):
- `id`
- `order_id`
- `actor_user_id` (who did it)
- `event_type` (enum/string; examples below)
- `occurred_at`
- `summary` (short human-readable line for UI timeline, optional)
- `payload` (JSON; stores details like changed fields and values)
- `is_deleted` : All things should be soft deleted
- `is_test` : bool; self explanatory (for testing)

Suggested `event_type` set (MVP):
- `ORDER_CREATED`
- `ORDER_UPDATED` (field-level changes: customer, product type, quantity, dates, notes, etc.)
- `STATUS_CHANGED`
- `VENDOR_CHANGED`
- `DELIVERED_MARKED`
- `CANCELLED_MARKED`
- `SOFT_DELETED` / `RESTORED`

Payload shape (MVP — **diffs only**, decided):
- `changes`: `{ fieldName: { from: <value>, to: <value> } }`
- Include `reason` where relevant (e.g., cancellations, major date changes).
- Rationale: diffs are compact (important at 500+ orders/month) and directly useful for timeline UI ("changed status from NEW to IN_PROGRESS").

### 5.6 User (NEW requirement: AuthN/AuthZ)
Users are the shop owner (Dad) and employees. Every ledger entry must record who performed the action (`actor_user_id`).

Roles (MVP):
- `OWNER` (Dad)
- `EMPLOYEE`

Minimum fields (MVP):
- `id`
- `name`
- `role` (`OWNER`/`EMPLOYEE`)
- `phone` (unique login identifier; pick one primary)
- `password_hash` (hashed via `Bun.password` built-in; supports bcrypt/argon2, zero external deps)
- `active` (boolean)
- `created_at`
- `last_login_at` (optional)
- `is_deleted` : All things should be soft deleted
- `is_test` : bool; self explanatory (for testing)

Tenancy rule:
- Single shop only: no `shop_id` / no cross-shop boundaries.

---

## 6) Scope: MVP (v0.1)
### 6.1 Order lifecycle & pipeline
Requirements:
- Create an order in under ~30 seconds for a trained user.
- Update an order’s `status` in under ~5 seconds (ideally 1–2 taps/clicks).
- Assign/clear `current_vendor_id` from a dropdown when relevant.
- Keep an auditable order timeline (at minimum: last updated timestamp; ideally: change history).

Status model (MVP):
- `NEW`
- `IN_PROGRESS` (may include `process_stage` + optional `current_vendor_id`)
- `READY`
- `DELIVERED`
- `CANCELLED`

Note: `at_vendor` (from legacy code) is **removed**. Existing `at_vendor` orders migrate to `IN_PROGRESS` + `current_vendor_id` set from `vendorName`.

Delayed handling (MVP — **computed only**, decided):
- "DELAYED" is a **computed state** (`is_delayed`/`days_delayed`) based on `promised_date`, not a stored `status`. It is NOT in the status enum.
- In lists and detail views, show a prominent "DELAYED" badge when `is_delayed = true`, and allow filtering "Delayed only".

### 6.2 Order list (the “control tower”)
Requirements:
- **Cursor-based pagination** from day one (the order list will grow to thousands within months).
- Default view shows active orders sorted by:
  - (1) most delayed first, then
  - (2) promised (due) date soonest first, then
  - (3) recently updated
- Filters:
  - status
  - vendor
  - product type
  - customer
  - delayed only
  - promised (due) date range (today/this week/overdue)
- Search by customer name and order number/title.

### 6.3 Order detail view
Requirements:
- Show: customer, product type, promised (due) date, internal due date (if used), status, vendor (if any), notes, delay badge (if overdue).
- Quick actions:
  - change status
  - assign/clear vendor (typically while `IN_PROGRESS`)
  - mark delivered (sets `delivered_at`)
  - show timeline (from `order_ledger_entries`)

### 6.4 Manage master data (dropdown sources)
Requirements:
- CRUD (create, view, edit, deactivate) for:
  - vendors
  - product types
  - customers (at least create/edit; delete optional)
- Deactivate instead of delete to preserve historical orders.

Permissions (MVP suggestion):
- `OWNER`: full CRUD on vendors + product types; can edit any customer.
- `EMPLOYEE`: can create/edit customers; can view vendors/product types; cannot delete/deactivate vendors/product types.

### 6.5 Authentication & authorization (IAM)
AuthN (MVP requirements):
- Users must sign in to use the app.
- **Auth mechanism:** JWT stored in HttpOnly cookie with long expiry (~1 year). Device-based auth — login once per device, stay logged in.
- **Revocation:** `token_revoked_before` timestamp on `users` table. If `jwt.iat < user.token_revoked_before`, token is rejected. Allows force-logout per user.
- **Password hashing:** `Bun.password.hash()` (built-in, zero deps).
- **Bootstrap:** First OWNER user registered manually via backend (no first-run setup screen).
- Passwords must be hashed and never stored in plaintext.

AuthZ (MVP requirements):
- Enforce RBAC on both UI and API/server.
- All write actions must be attributable: every order mutation inserts an `order_ledger_entries` row with `actor_user_id`.

Authorization matrix (MVP):
- Orders: `OWNER` and `EMPLOYEE` can create and edit orders; both can change status/vendor and mark delivered/cancelled.
- Users: only `OWNER` can create/deactivate employee accounts and change roles.
- Master data: see §6.4 permissions.
- Audit history (ledger): both roles can view order history; only `OWNER` can export/backup if/when added.

---

## 7) Future scope (not MVP)
### 7.1 Quotations
- Create quote requests and generate quotations (possibly PDF/print).
- Convert accepted quote into an order.

### 7.2 Billing / invoices
- Generate bills for delivered orders.
- Track payment status.

### 7.3 More robust workflow
- Configurable stages per product type.
- Multi-vendor hops per order (history + current).
- SLA-based delay definitions per stage.

---

## 8) Non-functional requirements
- **Speed:** list loads fast for 500+ active records; typical operations feel instant.
- **Reliability:** no data loss; safe updates when multiple employees edit.
- **Simplicity:** mobile-first friendly UI (many updates happen on the floor).
- **Data migration:** not needed — no legacy production data. Clean start with new schema.
- **Security:** least-privilege access (RBAC), secure session management, and immutable audit trail (append-only ledger).

## 9) Success metrics (MVP)
- Time to create an order ≤ 30s (trained user)
- Time to update status ≤ 5s
- Owner can answer “what’s overdue?” in ≤ 10s from opening the app
- Fewer missed deadlines / fewer “where is my order” calls (qualitative initially)

## 10) Open questions (to answer before building)
All resolved (2026-02-16):

1. **Statuses:** `NEW`, `IN_PROGRESS`, `READY`, `DELIVERED`, `CANCELLED`. `DELAYED` is computed only (not a stored status). `at_vendor` removed.
2. **History:** Full order history via append-only **Order Ledger** (`order_ledger_entries`); current state derivable from ledger.
3. **Dates:** All stored as full ISO timestamps. `received_date`, `promised_date` (required, drives delay), optional `internal_due_date`, `delivered_at`.
4. **Tenancy:** Single shop only.
5. **Auth:** JWT in HttpOnly cookie, long expiry (~1 year). Device-based — login once per device. JWT stores `user_id` only (role read from DB on each request). `token_revoked_before` on users table for force-logout.
6. **Password hashing:** `Bun.password` (built-in, zero deps).
7. **Order number:** Date-prefixed auto-generated (`YYMM-NNNN`, e.g., `2602-0001`).
8. **Ledger payload:** Diffs only (`{ field: { from, to } }`).
9. **Pagination:** Cursor-based from day one.
10. **One-off customers:** No. Always create a customer record.
11. **Process stage:** Dropdown with predefined options + "Other" free text. Stored as free text.
12. **Seed user:** First OWNER registered manually via backend.
13. **ID format:** Prefixed readable IDs (e.g., `O-...`, `U-...`).
14. **Column naming:** snake_case in DB, mapped in repositories.
15. **Legacy backfill:** Not needed — no production data exists. Clean start. `promised_date` required going forward.
