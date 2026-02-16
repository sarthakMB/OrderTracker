-- Orders table — the "current state projection" for each order.
-- This is the main table for listing/filtering/sorting.
-- Every mutation also writes to order_ledger_entries (see 006).
--
-- Status values: NEW, IN_PROGRESS, READY, DELIVERED, CANCELLED
-- Note: DELAYED is computed (not stored). at_vendor is gone —
-- use IN_PROGRESS + current_vendor_id instead.

CREATE TABLE orders (
  id                TEXT PRIMARY KEY,
  order_number      TEXT NOT NULL UNIQUE,
  customer_id       TEXT NOT NULL REFERENCES customers(id),
  product_type_id   TEXT NOT NULL REFERENCES product_types(id),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  quantity          INTEGER,
  status            TEXT NOT NULL DEFAULT 'NEW',
  process_stage     TEXT NOT NULL DEFAULT '',
  current_vendor_id TEXT REFERENCES vendors(id),
  received_date     TEXT NOT NULL,
  promised_date     TEXT NOT NULL,
  internal_due_date TEXT,
  delivered_at      TEXT,
  notes             TEXT NOT NULL DEFAULT '',
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  is_test           INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
