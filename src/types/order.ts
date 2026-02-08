/**
 * Types for the Order Tracker app.
 *
 * These types define the shape of our data. TypeScript uses them to catch
 * mistakes at compile time — for example, if you try to set an order's status
 * to "done" (which isn't in our list), TypeScript will show an error.
 */

/**
 * All possible statuses an order can have.
 *
 * This is a "union type" — it means OrderStatus can ONLY be one of these
 * exact strings. Any other string will cause a TypeScript error.
 */
export type OrderStatus =
  | "new"
  | "in_progress"
  | "at_vendor"
  | "ready"
  | "delivered"
  | "delayed"
  | "cancelled";

/**
 * The full Order object as stored in localStorage.
 *
 * An "interface" defines the shape of an object — what properties it has
 * and what type each property is. Think of it like a blueprint.
 */
export interface Order {
  /** Unique identifier for each order (generated when created) */
  id: string;
  /** Name of the customer who placed the order */
  customerName: string;
  /** Phone number or other contact info (optional) */
  customerContact: string;
  /** What's being printed / ordered */
  orderDescription: string;
  /** Which vendor is currently handling this order (optional) */
  vendorName: string;
  /** Current status of the order */
  status: OrderStatus;
  /** Any extra notes about the order */
  notes: string;
  /** When the order was created (ISO date string) */
  createdAt: string;
  /** When the order was last updated (ISO date string) */
  updatedAt: string;
}

/**
 * The data we collect from the order form (create/edit).
 *
 * This is separate from Order because the form doesn't include fields like
 * `id`, `createdAt`, or `updatedAt` — those are generated automatically.
 *
 * "Omit" is a TypeScript utility that takes an interface and removes
 * specific keys. So this is "Order minus id, createdAt, updatedAt".
 */
export type OrderFormData = Omit<Order, "id" | "createdAt" | "updatedAt">;
