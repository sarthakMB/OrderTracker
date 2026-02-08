/**
 * Order Service — the ONLY file that touches localStorage.
 *
 * This is the "service layer" pattern. All data read/write goes through
 * here. Components never call localStorage directly. This means when we
 * migrate to Supabase later, we only change THIS file — everything else
 * stays the same.
 *
 * Each function here is a simple CRUD operation:
 *   C - Create (createOrder)
 *   R - Read   (getAllOrders, getOrderById)
 *   U - Update (updateOrder)
 *   D - Delete (deleteOrder)
 */

import type { Order, OrderFormData } from "@/types/order";
import { STORAGE_KEY } from "@/lib/constants";

// ─── Private helpers (not exported) ──────────────────────────────────

/**
 * Load all orders from localStorage.
 * Returns an empty array if nothing is stored yet.
 */
function loadOrders(): Order[] {
  const data = localStorage.getItem(STORAGE_KEY);

  // If there's no data yet (first time using the app), return empty array
  if (!data) return [];

  // JSON.parse converts the stored string back into a JavaScript array
  return JSON.parse(data) as Order[];
}

/**
 * Save the full orders array to localStorage.
 * This overwrites whatever was there before.
 */
function saveOrders(orders: Order[]): void {
  // JSON.stringify converts the array into a string for storage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

/**
 * Generate a simple unique ID for new orders.
 *
 * crypto.randomUUID() creates a UUID like "a1b2c3d4-e5f6-...".
 * It's built into all modern browsers — no library needed.
 */
function generateId(): string {
  return crypto.randomUUID();
}

// ─── Public API (exported for use by the app) ────────────────────────

/** Get all orders from storage */
export function getAllOrders(): Order[] {
  return loadOrders();
}

/** Find a single order by its ID. Returns undefined if not found. */
export function getOrderById(id: string): Order | undefined {
  const orders = loadOrders();

  // .find() returns the first item that matches, or undefined
  return orders.find((order) => order.id === id);
}

/**
 * Create a new order and save it to storage.
 *
 * Takes the form data (without id/dates) and adds the generated fields.
 * Returns the complete new order.
 */
export function createOrder(formData: OrderFormData): Order {
  const orders = loadOrders();
  const now = new Date().toISOString();

  // Build the full order object by combining form data with generated fields
  const newOrder: Order = {
    ...formData, // spread operator copies all properties from formData
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  // Add to the beginning of the array so newest orders appear first
  orders.unshift(newOrder);
  saveOrders(orders);

  return newOrder;
}

/**
 * Update an existing order.
 *
 * "Partial<OrderFormData>" means we can pass just the fields we want to
 * change — we don't have to pass every single field. TypeScript's Partial
 * makes all properties optional.
 */
export function updateOrder(
  id: string,
  updates: Partial<OrderFormData>
): Order | undefined {
  const orders = loadOrders();

  // Find which position in the array this order is at
  const index = orders.findIndex((order) => order.id === id);

  // If we didn't find it, return undefined
  if (index === -1) return undefined;

  // Merge the existing order with the updates
  const updatedOrder: Order = {
    ...orders[index], // keep existing fields
    ...updates, // overwrite with new values
    updatedAt: new Date().toISOString(), // always update the timestamp
  };

  // Replace the old order in the array
  orders[index] = updatedOrder;
  saveOrders(orders);

  return updatedOrder;
}

/**
 * Delete an order by ID.
 * Returns true if the order was found and deleted, false otherwise.
 */
export function deleteOrder(id: string): boolean {
  const orders = loadOrders();
  const initialLength = orders.length;

  // .filter() creates a new array WITHOUT the matching order
  const filtered = orders.filter((order) => order.id !== id);

  // If lengths are the same, nothing was removed (order not found)
  if (filtered.length === initialLength) return false;

  saveOrders(filtered);
  return true;
}
