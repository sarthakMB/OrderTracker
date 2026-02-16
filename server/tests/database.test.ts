/**
 * Phase 1 tests — Database foundation.
 *
 * Tests the migration runner, schema creation, ledger immutability triggers,
 * ID generation, and order number generation.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { createTestDb, type TestDb } from "./setup";
import { runMigrations } from "../src/db/migrate";
import {
  generateOrderId,
  generateCustomerId,
  generateVendorId,
  generateUserId,
  generateProductTypeId,
  generateLedgerEntryId,
} from "../src/utils/ids";
import { generateOrderNumber } from "../src/utils/orderNumber";

// ── Migration runner ──────────────────────────────────────────────

describe("migration runner", () => {
  test("applies migrations in order", () => {
    // Create a raw DB (no migrations yet)
    const db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");

    runMigrations(db);

    // Check that all 9 migrations were recorded
    const applied = db
      .query("SELECT name FROM schema_migrations ORDER BY name")
      .all() as { name: string }[];

    expect(applied.length).toBe(9);
    expect(applied[0].name).toBe("001_create_customers.sql");
    expect(applied[8].name).toBe("009_seed_product_types.sql");

    db.close();
  });

  test("skips already-applied migrations", () => {
    // Run migrations once
    const db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    runMigrations(db);

    // Run again — should not fail or duplicate
    runMigrations(db);

    const applied = db
      .query("SELECT name FROM schema_migrations")
      .all() as { name: string }[];

    // Still exactly 9 (no duplicates)
    expect(applied.length).toBe(9);

    db.close();
  });
});

// ── Schema verification ───────────────────────────────────────────

describe("schema", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });
  afterEach(() => {
    testDb.cleanup();
  });

  test("all tables are created", () => {
    const tables = testDb.db
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("schema_migrations");
    expect(tableNames).toContain("customers");
    expect(tableNames).toContain("vendors");
    expect(tableNames).toContain("product_types");
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("orders");
    expect(tableNames).toContain("order_ledger_entries");
  });

  test("customers table has correct columns", () => {
    const columns = testDb.db.query("PRAGMA table_info(customers)").all() as {
      name: string;
    }[];
    const colNames = columns.map((c) => c.name);

    expect(colNames).toEqual([
      "id",
      "name",
      "phone",
      "notes",
      "is_deleted",
      "is_test",
      "created_at",
      "updated_at",
    ]);
  });

  test("orders table has correct columns", () => {
    const columns = testDb.db.query("PRAGMA table_info(orders)").all() as {
      name: string;
    }[];
    const colNames = columns.map((c) => c.name);

    expect(colNames).toEqual([
      "id",
      "order_number",
      "customer_id",
      "product_type_id",
      "title",
      "description",
      "quantity",
      "status",
      "process_stage",
      "current_vendor_id",
      "received_date",
      "promised_date",
      "internal_due_date",
      "delivered_at",
      "notes",
      "is_deleted",
      "is_test",
      "created_at",
      "updated_at",
    ]);
  });

  test("order_ledger_entries table has correct columns", () => {
    const columns = testDb.db
      .query("PRAGMA table_info(order_ledger_entries)")
      .all() as { name: string }[];
    const colNames = columns.map((c) => c.name);

    expect(colNames).toEqual([
      "id",
      "order_id",
      "actor_user_id",
      "event_type",
      "occurred_at",
      "summary",
      "payload",
      "is_deleted",
      "is_test",
    ]);
  });

  test("product types are seeded", () => {
    const productTypes = testDb.db
      .query("SELECT id, name FROM product_types ORDER BY name")
      .all() as { id: string; name: string }[];

    expect(productTypes.length).toBe(3);
    expect(productTypes.map((pt) => pt.name)).toEqual([
      "Cartons",
      "Labels",
      "Leaflets",
    ]);
  });

  test("indexes are created", () => {
    const indexes = testDb.db
      .query(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
      )
      .all() as { name: string }[];

    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain("idx_orders_status");
    expect(indexNames).toContain("idx_orders_promised_date");
    expect(indexNames).toContain("idx_orders_current_vendor_id");
    expect(indexNames).toContain("idx_orders_product_type_id");
    expect(indexNames).toContain("idx_orders_customer_id");
    expect(indexNames).toContain("idx_orders_updated_at");
    expect(indexNames).toContain("idx_ledger_order_occurred");
  });
});

// ── Ledger immutability triggers ──────────────────────────────────

describe("ledger immutability", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    // Insert prerequisite data so we can create a ledger entry
    testDb.db.exec(`
      INSERT INTO customers (id, name) VALUES ('C-test0001', 'Test Customer');
      INSERT INTO users (id, name, phone, password_hash) VALUES ('U-test0001', 'Test User', '1234567890', 'hash');
      INSERT INTO orders (id, order_number, customer_id, product_type_id, title, received_date, promised_date)
        VALUES ('O-test0001', '2602-0001', 'C-test0001', 'PT-cartons', 'Test Order', '2026-02-01', '2026-02-15');
      INSERT INTO order_ledger_entries (id, order_id, actor_user_id, event_type, summary)
        VALUES ('LE-test0001', 'O-test0001', 'U-test0001', 'ORDER_CREATED', 'Order created');
    `);
  });

  afterEach(() => {
    testDb.cleanup();
  });

  test("UPDATE on ledger entry is blocked by trigger", () => {
    expect(() => {
      testDb.db.exec(
        "UPDATE order_ledger_entries SET summary = 'changed' WHERE id = 'LE-test0001'"
      );
    }).toThrow("immutable");
  });

  test("DELETE on ledger entry is blocked by trigger", () => {
    expect(() => {
      testDb.db.exec(
        "DELETE FROM order_ledger_entries WHERE id = 'LE-test0001'"
      );
    }).toThrow("immutable");
  });
});

// ── ID generation ─────────────────────────────────────────────────

describe("ID generation", () => {
  test("generates IDs with correct prefixes", () => {
    expect(generateOrderId()).toMatch(/^O-[a-f0-9]{8}$/);
    expect(generateCustomerId()).toMatch(/^C-[a-f0-9]{8}$/);
    expect(generateVendorId()).toMatch(/^V-[a-f0-9]{8}$/);
    expect(generateUserId()).toMatch(/^U-[a-f0-9]{8}$/);
    expect(generateProductTypeId()).toMatch(/^PT-[a-f0-9]{8}$/);
    expect(generateLedgerEntryId()).toMatch(/^LE-[a-f0-9]{8}$/);
  });

  test("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateOrderId()));
    expect(ids.size).toBe(100);
  });
});

// ── Order number generation ───────────────────────────────────────

describe("order number generation", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    // Insert prerequisite data for orders
    testDb.db.exec(
      "INSERT INTO customers (id, name) VALUES ('C-test0001', 'Test Customer')"
    );
  });

  afterEach(() => {
    testDb.cleanup();
  });

  test("generates YYMM-0001 for first order of the month", () => {
    const orderNum = generateOrderNumber(testDb.db);

    // Should match YYMM-0001 pattern
    expect(orderNum).toMatch(/^\d{4}-0001$/);

    // The YYMM part should match current date
    const now = new Date();
    const expectedPrefix =
      String(now.getFullYear()).slice(-2) +
      String(now.getMonth() + 1).padStart(2, "0");
    expect(orderNum.startsWith(expectedPrefix)).toBe(true);
  });

  test("increments sequence for existing orders in same month", () => {
    const now = new Date();
    const prefix =
      String(now.getFullYear()).slice(-2) +
      String(now.getMonth() + 1).padStart(2, "0");

    // Insert an existing order with sequence 0005
    testDb.db.exec(`
      INSERT INTO orders (id, order_number, customer_id, product_type_id, title, received_date, promised_date)
        VALUES ('O-existing1', '${prefix}-0005', 'C-test0001', 'PT-cartons', 'Existing Order', '2026-02-01', '2026-02-15');
    `);

    const nextNum = generateOrderNumber(testDb.db);
    expect(nextNum).toBe(`${prefix}-0006`);
  });
});
