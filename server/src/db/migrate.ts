/**
 * Migration runner — applies SQL migration files in order.
 *
 * How it works:
 * 1. Creates a `schema_migrations` table to track which migrations have run
 * 2. Reads all `.sql` files from the `migrations/` folder
 * 3. Sorts them by filename (so `001_...` runs before `002_...`)
 * 4. Skips any that have already been applied
 * 5. Runs the rest inside a transaction (fail-fast: if one fails, none apply)
 *
 * This replaces the old "CREATE TABLE IF NOT EXISTS" approach,
 * which can't handle schema changes over time.
 */

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

/**
 * The table that tracks which migrations have been applied.
 * `name` is the filename (e.g., "001_create_customers.sql").
 * `applied_at` records when it was run.
 */
const CREATE_SCHEMA_MIGRATIONS = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

/**
 * Runs all pending migrations against the given database.
 *
 * @param db - The SQLite database instance
 * @param migrationsDir - Path to the folder containing .sql files.
 *                        Defaults to the `migrations/` folder next to this file.
 */
export function runMigrations(
  db: Database,
  migrationsDir?: string
): void {
  // Default to the migrations/ folder next to this file
  const dir = migrationsDir ?? resolve(import.meta.dir, "migrations");

  // Step 1: Ensure the schema_migrations table exists
  db.exec(CREATE_SCHEMA_MIGRATIONS);

  // Step 2: Read all .sql files and sort them alphabetically
  // This is why we prefix with numbers: 001_, 002_, etc.
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    // If the migrations directory doesn't exist, nothing to do
    return;
  }

  if (files.length === 0) return;

  // Step 3: Find out which migrations have already been applied
  const applied = new Set(
    db
      .query("SELECT name FROM schema_migrations")
      .all()
      .map((row: any) => row.name)
  );

  // Step 4: Filter to only pending (not yet applied) migrations
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) return;

  // Step 5: Apply each pending migration inside a transaction.
  // If any migration fails, the whole batch rolls back — no partial state.
  db.exec("BEGIN");
  try {
    for (const file of pending) {
      const sql = readFileSync(join(dir, file), "utf-8");
      db.exec(sql);

      // Record that this migration has been applied
      db.query("INSERT INTO schema_migrations (name) VALUES (?)").run(file);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
