/**
 * Test setup helper — creates a fresh database for each test.
 *
 * Phase 1 tests only need the database layer (no HTTP server).
 * Each test gets its own in-memory SQLite database with all migrations applied.
 *
 * Usage in tests:
 *   let testDb: TestDb;
 *   beforeEach(() => { testDb = createTestDb(); });
 *   afterEach(() => { testDb.cleanup(); });
 */

import { Database } from "bun:sqlite";
import { createDatabase } from "../src/db/database";

/** What createTestDb returns — a ready-to-use DB and a cleanup function */
export interface TestDb {
  /** The SQLite database instance with all migrations applied */
  db: Database;
  /** Call this in afterEach to close the database */
  cleanup: () => void;
}

/**
 * Creates a fresh test database with all migrations applied.
 *
 * Uses ":memory:" so each test is fast and isolated — no disk I/O,
 * no leftover data between tests.
 */
export function createTestDb(): TestDb {
  // createDatabase(":memory:") will:
  // 1. Create an in-memory SQLite DB
  // 2. Enable WAL mode + foreign keys
  // 3. Run all migrations (creates tables, indexes, triggers, seeds)
  const db = createDatabase(":memory:");

  return {
    db,
    cleanup: () => {
      db.close();
    },
  };
}
