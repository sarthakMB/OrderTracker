/**
 * Order API endpoint tests.
 *
 * These tests verify that all CRUD operations work correctly.
 * Each test gets a fresh in-memory database (via createTestApp)
 * so tests don't interfere with each other.
 *
 * Run with:        bun test
 * Run in TDD mode: bun test --watch
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestApp } from "./setup";

// ─── Test lifecycle ─────────────────────────────────────────────────
// These variables are set fresh before each test and cleaned up after

let baseUrl: string;
let cleanup: () => void;

beforeEach(async () => {
  const testApp = await createTestApp();
  baseUrl = testApp.baseUrl;
  cleanup = testApp.cleanup;
});

afterEach(() => {
  cleanup();
});

// ─── Helper ─────────────────────────────────────────────────────────

/**
 * Shorthand to create an order via the API.
 * Returns the parsed JSON response.
 * You can override any field by passing it in the overrides object.
 */
async function createTestOrder(overrides = {}) {
  const defaultOrder = {
    customerName: "John Doe",
    customerContact: "555-1234",
    orderDescription: "100 business cards",
    vendorName: "PrintCo",
    status: "new",
    notes: "Rush order",
  };

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...defaultOrder, ...overrides }),
  });

  return res.json();
}

// ─── Health Check ───────────────────────────────────────────────────

describe("GET /health", () => {
  test("returns status ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ status: "ok" });
  });
});

// ─── GET /api/orders ────────────────────────────────────────────────

describe("GET /api/orders", () => {
  test("returns empty array when no orders exist", async () => {
    const res = await fetch(`${baseUrl}/api/orders`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, data: [] });
  });

  test("returns all orders after creating some", async () => {
    await createTestOrder({ customerName: "Alice" });
    await createTestOrder({ customerName: "Bob" });

    const res = await fetch(`${baseUrl}/api/orders`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
  });

  test("returns orders sorted newest first", async () => {
    await createTestOrder({ customerName: "First" });
    await createTestOrder({ customerName: "Second" });

    const res = await fetch(`${baseUrl}/api/orders`);
    const data = await res.json();

    // "Second" was created after "First", so it should appear first
    expect(data.data[0].customerName).toBe("Second");
    expect(data.data[1].customerName).toBe("First");
  });
});

// ─── GET /api/orders/:id ────────────────────────────────────────────

describe("GET /api/orders/:id", () => {
  test("returns the order if it exists", async () => {
    const created = await createTestOrder({ customerName: "Alice" });
    const orderId = created.data.id;

    const res = await fetch(`${baseUrl}/api/orders/${orderId}`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.customerName).toBe("Alice");
    expect(data.data.id).toBe(orderId);
  });

  test("returns 404 for non-existent order", async () => {
    const res = await fetch(`${baseUrl}/api/orders/does-not-exist`);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Order not found");
  });
});

// ─── POST /api/orders ───────────────────────────────────────────────

describe("POST /api/orders", () => {
  test("creates an order and returns it with id and timestamps", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Jane Smith",
        customerContact: "555-5678",
        orderDescription: "200 flyers",
        vendorName: "FlyerMaster",
        status: "new",
        notes: "Double-sided",
      }),
    });

    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.customerName).toBe("Jane Smith");
    expect(data.data.orderDescription).toBe("200 flyers");
    // Server should generate these fields automatically
    expect(data.data.id).toBeDefined();
    expect(data.data.createdAt).toBeDefined();
    expect(data.data.updatedAt).toBeDefined();
  });

  test("returns 400 when customerName is missing", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderDescription: "Some flyers",
      }),
    });

    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("customerName");
  });

  test("returns 400 when orderDescription is missing", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Alice",
      }),
    });

    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("orderDescription");
  });

  test("uses default values for optional fields", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Bob",
        orderDescription: "Posters",
      }),
    });

    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.data.customerContact).toBe("");
    expect(data.data.vendorName).toBe("");
    expect(data.data.status).toBe("new");
    expect(data.data.notes).toBe("");
  });
});

// ─── PATCH /api/orders/:id ──────────────────────────────────────────

describe("PATCH /api/orders/:id", () => {
  test("updates only the specified fields", async () => {
    const created = await createTestOrder({
      customerName: "Alice",
      status: "new",
    });
    const orderId = created.data.id;

    const res = await fetch(`${baseUrl}/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });

    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // Status should be updated
    expect(data.data.status).toBe("in_progress");
    // Other fields should remain unchanged
    expect(data.data.customerName).toBe("Alice");
  });

  test("updates the updatedAt timestamp", async () => {
    const created = await createTestOrder();
    const orderId = created.data.id;
    const originalUpdatedAt = created.data.updatedAt;

    // Small delay so the timestamp will definitely be different
    await new Promise((resolve) => setTimeout(resolve, 10));

    const res = await fetch(`${baseUrl}/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Updated note" }),
    });

    const data = await res.json();

    expect(data.data.updatedAt).not.toBe(originalUpdatedAt);
  });

  test("returns 404 for non-existent order", async () => {
    const res = await fetch(`${baseUrl}/api/orders/does-not-exist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    });

    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Order not found");
  });
});

// ─── DELETE /api/orders/:id ─────────────────────────────────────────

describe("DELETE /api/orders/:id", () => {
  test("deletes the order and returns success", async () => {
    const created = await createTestOrder();
    const orderId = created.data.id;

    const res = await fetch(`${baseUrl}/api/orders/${orderId}`, {
      method: "DELETE",
    });

    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ deleted: true });

    // Verify the order is actually gone
    const getRes = await fetch(`${baseUrl}/api/orders/${orderId}`);
    expect(getRes.status).toBe(404);
  });

  test("returns 404 for non-existent order", async () => {
    const res = await fetch(`${baseUrl}/api/orders/does-not-exist`, {
      method: "DELETE",
    });

    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Order not found");
  });
});
