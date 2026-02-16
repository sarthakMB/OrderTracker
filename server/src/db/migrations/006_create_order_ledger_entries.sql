-- Order ledger — append-only audit log for every order mutation.
-- Every write to the orders table MUST also insert one ledger entry.
-- Ledger rows are never updated or deleted (enforced by triggers in 008).
--
-- `payload` stores JSON diffs: { field: { from, to } }

CREATE TABLE order_ledger_entries (
  id             TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL REFERENCES orders(id),
  actor_user_id  TEXT NOT NULL REFERENCES users(id),
  event_type     TEXT NOT NULL,
  occurred_at    TEXT NOT NULL DEFAULT (datetime('now')),
  summary        TEXT NOT NULL DEFAULT '',
  payload        TEXT NOT NULL DEFAULT '{}',
  is_deleted     INTEGER NOT NULL DEFAULT 0,
  is_test        INTEGER NOT NULL DEFAULT 0
);
