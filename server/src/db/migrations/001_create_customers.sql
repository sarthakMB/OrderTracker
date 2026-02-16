-- Customers table — every order must belong to a customer.
-- Soft-deleted via is_deleted flag (never actually removed from DB).

CREATE TABLE customers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  is_test     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
