-- Vendors table — external businesses that process orders.
-- Has an `active` flag for deactivation (instead of delete).

CREATE TABLE vendors (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  service_type  TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  is_deleted    INTEGER NOT NULL DEFAULT 0,
  is_test       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
