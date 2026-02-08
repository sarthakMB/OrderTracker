/**
 * Order Service — the ONLY file that talks to the backend API.
 *
 * This is the "service layer" pattern. All data fetching goes through
 * here. Components never call fetch() directly. This means if the API
 * changes, we only update THIS file — everything else stays the same.
 *
 * Previously this file used localStorage. Now it calls the Express
 * backend at /api/orders. All functions are now async (return Promises).
 *
 * Each function is a simple CRUD operation:
 *   C - Create (createOrder)
 *   R - Read   (getAllOrders, getOrderById)
 *   U - Update (updateOrder)
 *   D - Delete (deleteOrder)
 */

import type { Order, OrderFormData } from "@/types/order";

/**
 * Base URL for all API requests.
 *
 * In development, Vite's proxy forwards /api requests to the backend.
 * In production, the backend serves both the API and the frontend,
 * so relative URLs work in both cases.
 */
const API_BASE = "/api/orders";

// ─── Private helper ─────────────────────────────────────────────────

/**
 * Makes a request to the API and returns the parsed data.
 *
 * All our API responses follow the format:
 *   Success: { success: true, data: ... }
 *   Error:   { success: false, error: "message" }
 *
 * This helper handles that format so each function doesn't have to.
 * If the API returns an error, it throws an Error with the message.
 */
async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();

  // If the API says it failed, throw so the caller can catch it
  if (!json.success) {
    throw new Error(json.error || "Something went wrong");
  }

  return json.data as T;
}

// ─── Public API (exported for use by the app) ────────────────────────

/** Get all orders from the backend */
export async function getAllOrders(): Promise<Order[]> {
  return apiRequest<Order[]>(API_BASE);
}

/** Find a single order by its ID. Returns undefined if not found. */
export async function getOrderById(id: string): Promise<Order | undefined> {
  try {
    return await apiRequest<Order>(`${API_BASE}/${id}`);
  } catch {
    // If the order doesn't exist (404), return undefined instead of throwing
    return undefined;
  }
}

/**
 * Create a new order via the API.
 *
 * The server generates the id, createdAt, and updatedAt fields.
 * Returns the complete new order.
 */
export async function createOrder(formData: OrderFormData): Promise<Order> {
  return apiRequest<Order>(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
}

/**
 * Update an existing order.
 *
 * Only sends the fields that changed — the server merges them
 * with the existing data and bumps the updatedAt timestamp.
 */
export async function updateOrder(
  id: string,
  updates: Partial<OrderFormData>
): Promise<Order | undefined> {
  try {
    return await apiRequest<Order>(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  } catch {
    return undefined;
  }
}

/**
 * Delete an order by ID.
 * Returns true if successful, false if the order wasn't found.
 */
export async function deleteOrder(id: string): Promise<boolean> {
  try {
    await apiRequest<{ deleted: true }>(`${API_BASE}/${id}`, {
      method: "DELETE",
    });
    return true;
  } catch {
    return false;
  }
}
