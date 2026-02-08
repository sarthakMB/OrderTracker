/**
 * App-wide constants.
 *
 * Keeping "magic strings" and config values in one place means:
 * 1. We only update them in one spot if they change
 * 2. We get autocomplete when using them
 * 3. Typos get caught at compile time
 */

import type { OrderStatus } from "@/types/order";

/** The key used to store orders in localStorage */
export const STORAGE_KEY = "order-tracker-orders";

/**
 * All order statuses in the order they should appear in the UI.
 *
 * "as const" tells TypeScript to treat this array as a fixed tuple
 * (readonly and with exact string types), not just string[].
 */
export const ORDER_STATUS_LIST: OrderStatus[] = [
  "new",
  "in_progress",
  "at_vendor",
  "ready",
  "delivered",
  "delayed",
  "cancelled",
];

/**
 * Human-readable labels for each status.
 *
 * "Record<OrderStatus, string>" means: an object where every key is an
 * OrderStatus and every value is a string. TypeScript will error if we
 * forget to add a label for any status.
 */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  at_vendor: "At Vendor",
  ready: "Ready",
  delivered: "Delivered",
  delayed: "Delayed",
  cancelled: "Cancelled",
};

/**
 * Tailwind color classes for each status badge.
 *
 * These map to shadcn Badge "variant" isn't flexible enough for custom
 * colors, so we apply these classes directly.
 */
export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  at_vendor: "bg-purple-100 text-purple-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-800",
  delayed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-200 text-gray-500",
};
