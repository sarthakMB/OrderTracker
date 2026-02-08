/**
 * Pure utility functions for working with orders.
 *
 * "Pure functions" means:
 * - They take input and return output — no side effects
 * - They don't modify the original data
 * - They don't read/write from storage
 * - Given the same input, they always return the same output
 *
 * This makes them easy to test and reason about.
 */

import type { Order, OrderStatus } from "@/types/order";

/**
 * Filter orders by status.
 *
 * If status is null, returns all orders (used for the "All" tab).
 */
export function filterOrdersByStatus(
  orders: Order[],
  status: OrderStatus | null
): Order[] {
  // null means "show all" — no filtering needed
  if (status === null) return orders;

  return orders.filter((order) => order.status === status);
}

/**
 * Search orders by customer name, vendor name, or description.
 *
 * Does a case-insensitive search across multiple fields.
 * Returns all orders if the query is empty.
 */
export function searchOrders(orders: Order[], query: string): Order[] {
  // If search is empty or just whitespace, return everything
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") return orders;

  return orders.filter((order) => {
    // Check if the query appears in any of these fields
    return (
      order.customerName.toLowerCase().includes(trimmed) ||
      order.vendorName.toLowerCase().includes(trimmed) ||
      order.orderDescription.toLowerCase().includes(trimmed)
    );
  });
}

/**
 * Sort orders by date (newest first).
 *
 * Note: we create a new array with [...orders] (spread into a new array)
 * because .sort() modifies the original array, and we don't want side effects.
 */
export function sortOrdersByDate(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    // Compare ISO date strings — newer dates are "greater"
    // Subtracting gives us: negative (a before b), zero (same), positive (a after b)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Count how many orders are in each status.
 *
 * Returns an object like: { new: 3, in_progress: 5, delivered: 2, ... }
 *
 * "Record<OrderStatus, number>" means an object where every OrderStatus
 * is a key and every value is a number.
 */
export function getOrderCountsByStatus(
  orders: Order[]
): Record<OrderStatus, number> {
  // Start with zero for every status
  const counts: Record<OrderStatus, number> = {
    new: 0,
    in_progress: 0,
    at_vendor: 0,
    ready: 0,
    delivered: 0,
    delayed: 0,
    cancelled: 0,
  };

  // Count each order's status
  for (const order of orders) {
    counts[order.status]++;
  }

  return counts;
}
