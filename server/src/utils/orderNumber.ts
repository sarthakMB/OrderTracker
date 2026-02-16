/**
 * Order number generator — creates human-readable order numbers.
 *
 * Format: YYMM-NNNN (e.g., "2602-0001" = first order in Feb 2026)
 *
 * How it works:
 * 1. Build the YYMM prefix from the current date
 * 2. Query the DB for the highest order_number with that prefix
 * 3. Increment the sequence number (or start at 0001)
 *
 * This gives ~9999 orders per month, which is more than enough.
 */

import { Database } from "bun:sqlite";

/**
 * Generates the next order number for the current month.
 *
 * @param db - The SQLite database to query for the current max
 * @returns The next order number string, e.g. "2602-0042"
 */
export function generateOrderNumber(db: Database): string {
  const now = new Date();

  // YY = last 2 digits of year, MM = zero-padded month
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${yy}${mm}`;

  // Find the highest existing order_number for this month.
  // LIKE 'YYMM-%' matches all orders from this month.
  const result = db
    .query(
      "SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1"
    )
    .get(`${prefix}-%`) as { order_number: string } | null;

  let nextSeq = 1;

  if (result) {
    // Extract the sequence part after the dash: "2602-0042" → "0042" → 42
    const currentSeq = parseInt(result.order_number.split("-")[1], 10);
    nextSeq = currentSeq + 1;
  }

  // Pad to 4 digits: 1 → "0001", 42 → "0042"
  const seqStr = String(nextSeq).padStart(4, "0");

  return `${prefix}-${seqStr}`;
}
