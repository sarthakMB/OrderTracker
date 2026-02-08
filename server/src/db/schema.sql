-- Orders table — matches the Order interface in src/types/order.ts
--
-- Column names use camelCase to match the TypeScript types directly,
-- so we don't need any mapping layer between the DB and the API.

CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,
  customerName      TEXT NOT NULL,
  customerContact   TEXT NOT NULL DEFAULT '',
  orderDescription  TEXT NOT NULL,
  vendorName        TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'new',
  notes             TEXT NOT NULL DEFAULT '',
  createdAt         TEXT NOT NULL,
  updatedAt         TEXT NOT NULL
);
