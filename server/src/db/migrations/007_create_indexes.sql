-- Indexes for fast filtering, sorting, and lookups.
-- These match the list/filter/sort patterns from the PRD.

-- Orders: filter by status (most common filter)
CREATE INDEX idx_orders_status ON orders(status);

-- Orders: sort by promised_date (due date sorting, delay computation)
CREATE INDEX idx_orders_promised_date ON orders(promised_date);

-- Orders: filter by vendor
CREATE INDEX idx_orders_current_vendor_id ON orders(current_vendor_id);

-- Orders: filter by product type
CREATE INDEX idx_orders_product_type_id ON orders(product_type_id);

-- Orders: filter by customer
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Orders: sort by last updated
CREATE INDEX idx_orders_updated_at ON orders(updated_at);

-- Ledger: fetch timeline for an order, sorted by time
CREATE INDEX idx_ledger_order_occurred ON order_ledger_entries(order_id, occurred_at);
