/**
 * Database module — creates and initializes the SQLite database.
 *
 * Uses Bun's built-in SQLite support (bun:sqlite). No external database
 * library needed — it comes free with the Bun runtime.
 *
 * On startup, runs all pending migrations (see migrate.ts).
 * If any migration fails, the server won't start (fail-fast).
 */

import { Database } from "bun:sqlite";
import { runMigrations } from "./migrate";

/**
 * Creates and initializes a SQLite database.
 *
 * @param path - File path for the database. Use ":memory:" for tests
 *               (creates a temporary in-memory DB that's fast and isolated).
 * @param migrationsDir - Optional custom path to migrations folder (useful for tests).
 * @returns The initialized Database instance with all migrations applied.
 */
export function createDatabase(
  path: string = "./data/orders.db",
  migrationsDir?: string
): Database {
  const db = new Database(path);

  // WAL (Write-Ahead Logging) mode = faster writes and allows reading
  // while writing. Standard SQLite optimization for server applications.
  db.exec("PRAGMA journal_mode = WAL");

  // Enable foreign key enforcement — SQLite has it OFF by default.
  // Without this, REFERENCES constraints are just decorative.
  db.exec("PRAGMA foreign_keys = ON");

  // Run all pending migrations (creates tables, indexes, triggers, seeds).
  // Fails fast if any migration has an error — better to crash on startup
  // than to run with a broken schema.
  runMigrations(db, migrationsDir);

  return db;
}
