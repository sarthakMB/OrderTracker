-- Ledger immutability — triggers that block UPDATE and DELETE on ledger rows.
-- The ledger is append-only by design. These triggers are a safety net
-- that enforces this at the database level, even if app code has a bug.

CREATE TRIGGER ledger_no_update
BEFORE UPDATE ON order_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'order_ledger_entries rows are immutable — updates not allowed');
END;

CREATE TRIGGER ledger_no_delete
BEFORE DELETE ON order_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'order_ledger_entries rows are immutable — deletes not allowed');
END;
