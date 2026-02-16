-- Users table — app users (OWNER or EMPLOYEE).
-- `token_revoked_before` is used to invalidate all JWTs issued before that time.
-- Auth checks: if jwt.iat < user.token_revoked_before → reject token.

CREATE TABLE users (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'EMPLOYEE',
  phone                 TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  active                INTEGER NOT NULL DEFAULT 1,
  token_revoked_before  TEXT,
  is_deleted            INTEGER NOT NULL DEFAULT 0,
  is_test               INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at         TEXT
);
