/**
 * Order CRUD routes — handles all /api/orders endpoints.
 *
 * Each route handler follows the same simple pattern:
 *   1. Read from the request (params, body)
 *   2. Talk to the database
 *   3. Send a JSON response
 *
 * All responses use a consistent format:
 *   Success: { success: true, data: ... }
 *   Error:   { success: false, error: "message" }
 */

import { Router } from "express";
import type { Database } from "bun:sqlite";
import crypto from "crypto";

/**
 * Valid order statuses — must match the OrderStatus type in the frontend.
 * Used to validate incoming data so we don't store invalid statuses.
 */
const VALID_STATUSES = [
  "new",
  "in_progress",
  "at_vendor",
  "ready",
  "delivered",
  "delayed",
  "cancelled",
];

/**
 * Creates the orders router with all CRUD endpoints.
 *
 * The database is passed in as a parameter (dependency injection) so that
 * tests can use an in-memory database while production uses a file-based one.
 *
 * @param db - SQLite database instance
 * @returns Express Router with all order endpoints
 */
export function createOrderRoutes(db: Database) {
  const router = Router();

  // ─── GET /api/orders — list all orders ──────────────────────────

  router.get("/", (_req, res) => {
    // Fetch all orders, newest first (most useful for the shop owner)
    const orders = db
      .query("SELECT * FROM orders ORDER BY createdAt DESC")
      .all();

    res.json({ success: true, data: orders });
  });

  // ─── GET /api/orders/:id — get a single order ──────────────────

  router.get("/:id", (req, res) => {
    const order = db
      .query("SELECT * FROM orders WHERE id = ?")
      .get(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    res.json({ success: true, data: order });
  });

  // ─── POST /api/orders — create a new order ─────────────────────

  router.post("/", (req, res) => {
    const {
      customerName,
      customerContact,
      orderDescription,
      vendorName,
      status,
      notes,
    } = req.body;

    // Validate required fields — customerName and orderDescription are mandatory
    if (!customerName || !orderDescription) {
      return res.status(400).json({
        success: false,
        error: "customerName and orderDescription are required",
      });
    }

    // Validate status if provided (optional — defaults to "new")
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Generate a unique ID and timestamps (just like the frontend used to do)
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Build the complete order object with defaults for optional fields
    const order = {
      id,
      customerName,
      customerContact: customerContact || "",
      orderDescription,
      vendorName: vendorName || "",
      status: status || "new",
      notes: notes || "",
      createdAt: now,
      updatedAt: now,
    };

    // Insert into the database using named parameters ($param syntax)
    db.query(`
      INSERT INTO orders (id, customerName, customerContact, orderDescription,
                          vendorName, status, notes, createdAt, updatedAt)
      VALUES ($id, $customerName, $customerContact, $orderDescription,
              $vendorName, $status, $notes, $createdAt, $updatedAt)
    `).run({
      $id: order.id,
      $customerName: order.customerName,
      $customerContact: order.customerContact,
      $orderDescription: order.orderDescription,
      $vendorName: order.vendorName,
      $status: order.status,
      $notes: order.notes,
      $createdAt: order.createdAt,
      $updatedAt: order.updatedAt,
    });

    // 201 = "Created" — the standard HTTP status for successful resource creation
    res.status(201).json({ success: true, data: order });
  });

  // ─── PATCH /api/orders/:id — update an existing order ──────────

  router.patch("/:id", (req, res) => {
    // First check if the order exists
    const existing = db
      .query("SELECT * FROM orders WHERE id = ?")
      .get(req.params.id) as Record<string, unknown> | null;

    if (!existing) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // Validate status if it's being updated
    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Merge existing data with the updates (spread operator = copy all fields,
    // then overwrite with whatever the client sent)
    const updated = {
      ...existing,
      ...req.body,
      id: req.params.id, // prevent the ID from being changed
      updatedAt: new Date().toISOString(), // always bump the timestamp
    };

    db.query(`
      UPDATE orders
      SET customerName = $customerName,
          customerContact = $customerContact,
          orderDescription = $orderDescription,
          vendorName = $vendorName,
          status = $status,
          notes = $notes,
          updatedAt = $updatedAt
      WHERE id = $id
    `).run({
      $id: updated.id,
      $customerName: updated.customerName,
      $customerContact: updated.customerContact,
      $orderDescription: updated.orderDescription,
      $vendorName: updated.vendorName,
      $status: updated.status,
      $notes: updated.notes,
      $updatedAt: updated.updatedAt,
    });

    res.json({ success: true, data: updated });
  });

  // ─── DELETE /api/orders/:id — delete an order ──────────────────

  router.delete("/:id", (req, res) => {
    // Check if the order exists before trying to delete
    const existing = db
      .query("SELECT * FROM orders WHERE id = ?")
      .get(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    db.query("DELETE FROM orders WHERE id = ?").run(req.params.id);

    res.json({ success: true, data: { deleted: true } });
  });

  return router;
}
