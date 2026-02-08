/**
 * Database module — creates and initializes the SQLite database.
 *
 * Uses Bun's built-in SQLite support (bun:sqlite). No external database
 * library needed — it comes free with the Bun runtime.
 *
 * Exports a factory function so tests can create in-memory databases
 * while production uses a real file on disk.
 */

import { Database } from "bun:sqlite";

/**
 * SQL to create the orders table.
 *
 * "IF NOT EXISTS" means this is safe to run every time the server starts —
 * it only creates the table if it's not already there.
 *
 * Column names use camelCase to match the TypeScript Order interface,
 * so database rows map directly to our types with zero transformation.
 */
const CREATE_ORDERS_TABLE = `
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
  )
`;

/**
 * Creates and initializes a SQLite database.
 *
 * @param path - File path for the database. Use ":memory:" for tests
 *               (creates a temporary in-memory DB that's fast and isolated).
 * @returns The initialized Database instance, ready for queries.
 */
export function createDatabase(path: string = "./data/orders.db"): Database {
  const db = new Database(path);

  // WAL (Write-Ahead Logging) mode = faster writes and allows reading
  // while writing. This is a standard SQLite optimization you should
  // always enable for server applications.
  db.exec("PRAGMA journal_mode = WAL");

  // Create the orders table if it doesn't exist yet
  db.exec(CREATE_ORDERS_TABLE);

  return db;
}
