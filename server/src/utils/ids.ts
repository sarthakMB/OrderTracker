/**
 * ID generators — creates readable, prefixed IDs for all entities.
 *
 * Format: PREFIX-RANDOM (e.g., "O-a1b2c3d4", "C-x9y8z7w6")
 *
 * The prefix tells you what kind of entity it is at a glance:
 *   O  = Order
 *   C  = Customer
 *   V  = Vendor
 *   U  = User
 *   PT = Product Type
 *   LE = Ledger Entry
 *
 * The random part is 8 hex characters from crypto.randomUUID(),
 * giving ~4 billion possible IDs per prefix — plenty for a small shop.
 */

/**
 * Generates a prefixed ID.
 * Uses crypto.randomUUID() (built into Bun) for the random part,
 * then takes the first 8 characters (no dashes) for brevity.
 */
function generateId(prefix: string): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${prefix}-${random}`;
}

// One function per entity type — keeps call sites clear and typo-free

export const generateOrderId = () => generateId("O");
export const generateCustomerId = () => generateId("C");
export const generateVendorId = () => generateId("V");
export const generateUserId = () => generateId("U");
export const generateProductTypeId = () => generateId("PT");
export const generateLedgerEntryId = () => generateId("LE");
