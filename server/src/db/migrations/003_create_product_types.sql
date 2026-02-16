-- Product types — categories of products the shop handles.
-- `properties` is a JSON column for flexible per-type metadata.

CREATE TABLE product_types (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  properties  TEXT NOT NULL DEFAULT '{}',
  active      INTEGER NOT NULL DEFAULT 1,
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  is_test     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
