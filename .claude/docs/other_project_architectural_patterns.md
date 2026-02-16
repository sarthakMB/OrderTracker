# Backend Architecture

## Request Flow

```
HTTP Request → Middleware Chain → Route → Service → Repository → PostgreSQL
WebSocket    → Session Sharing  → Handler → Service → Repository → PostgreSQL
```

## Middleware Chain (`src/app.mjs`)

Order matters. Each middleware has a single responsibility.

```
Request → requestLogger → JSON/URL Parser → Static Files → Session → ensureSubject* → Routes
```

- **Session store**: Redis in production (`connect-redis`, TTL 30 days), MemoryStore in dev
- **`ensureSubject`**: Applied only to `/game/*` routes. Creates a guest in the DB and stores it in the session if no subject exists. Guarantees every game request has an identity.
- **Session structure**:
  ```javascript
  req.session.subject = { id: 'U...' | 'T...', type: 'user' | 'guest' }
  ```

## Route Mounting

```javascript
app.use('/', homeRouter);
app.use('/login', loginRouter);
app.use('/register', registerRouter);
app.use('/game', ensureSubject, gameRouter);
```

One router per resource. Pattern: `src/routes/{resource}.mjs`. Routes are thin — they parse HTTP, call a service method, and return a response.

**HTMX support**: Routes detect `HX-Request` header and return `HX-Redirect` or HTML fragments instead of JSON/redirects.

## Repository Layer (`src/repositories/`)

Data access only. Each repository wraps parameterized SQL queries against the PostgreSQL pool.

**Initialization** (`src/repositories/index.mjs`):
```javascript
import { pool } from '../../db/index.mjs';

export const userRepository = new UserRepository(pool);
export const guestRepository = new GuestRepository(pool);
export const gameRepository = new GameRepository(pool);
export const moveRepository = new MoveRepository(pool);
```

All repositories are singletons sharing the same connection pool.

**Repositories**: `UserRepository`, `GuestRepository`, `GameRepository`, `MoveRepository`

**Conventions**:
- Constructor accepts `pool` (dependency injection)
- `UNIQUE_FIELDS` whitelist for safe dynamic lookups
- Methods: `insert*()`, `find*()`, `update*()`, `delete*()` (soft delete)
- Return pattern: `{ success: true, data }` or `{ success: false, error: 'ERROR_CODE' }`
- PostgreSQL constraint violations (23505, 23502, 23514) caught and mapped to business error codes (`USERNAME_TAKEN`, `JOIN_CODE_TAKEN`, `DUPLICATE_MOVE`, etc.)
- Unexpected errors bubble up (throw)

## Service Layer (`src/services/`)

Business logic. Services depend on repositories, never on `pool` directly.

**Initialization** (`src/services/index.mjs`):
```javascript
export const authService = new AuthService(userRepository, guestRepository);
export const gameService = new GameService(gameRepository, moveRepository);
```

Singletons. Routes and WebSocket handlers import these.

**AuthService** (`src/services/AuthService.mjs`):
- `register(username, password, email?)` — bcrypt hash (12 rounds), calls `userRepo.insertUser()`
- `login(username, password)` — finds user, `bcrypt.compare()`, returns same error for "not found" and "wrong password" (no username enumeration)
- Strips `password_hash` from all return values

**GameService** (`src/services/GameService.mjs`):
- `createGame(mode, ownerId, ownerType, ownerColor, options?)` — validates mode, generates join code for friend games, retries on code collision
- `getGame(gameId)` — loads game + moves, derives current FEN from last move
- `joinGame(joinCode, playerId, playerType)` — validates game not full, player not joining own game
- `makeMove(gameId, playerId, moveInput)` — authorization check, turn validation, chess.js move validation, inserts move, checks game over
- chess.js instantiated per request (stateless — DB is source of truth)

## WebSocket Layer (`src/ws/`)

Socket.IO attached to the HTTP server. Shares Express session middleware.

**Setup** (`src/ws/index.mjs`):
- Wraps session middleware: `io.engine.use(sessionMiddleware)`
- Extracts subject from `socket.request.session` on connection
- Registers game handlers

**Game Handlers** (`src/ws/gameHandlers.mjs`):
- `join_game` → validates, calls `gameService.getGame()`, joins Socket.IO room, emits `game_state`
- `move` → calls `gameService.makeMove()`, broadcasts `move_made` to room, emits `game_over` if done
- Errors emitted to sender only: `{ code: 'ERROR_CODE', message: '...' }`

## Database

### PostgreSQL (`db/pool.mjs`)

Connection pool via `pg` library.
- Max connections: 20 (configurable via `PG_POOL_MAX`)
- Idle timeout: 30s, connection timeout: 2s
- Exports: `query(text, params)`, `getClient()` (for transactions), `getPoolStats()`
- Graceful shutdown on SIGTERM/SIGINT

### Redis (`db/redis.mjs`)

Singleton client via `redis` v5.
- Reconnection: exponential backoff (50ms → 3s, 10 retries)
- Lazy connection: `connectRedis()` must be called before use
- Helpers: `setWithTTL()`, `get()`, `del()`, `exists()`, `ping()`
- Used for: session storage

### Unified Export (`db/index.mjs`)

Re-exports everything from `pool.mjs` and `redis.mjs`. Also exports `initDatabases()` which connects Redis and tests PostgreSQL before the app starts (fail-fast).

## Migrations (`db/migrations/`)

**Runner**: `db/migrations/migrate.mjs` (invoked via `npm run migrate`)

1. Creates `schema_migrations` tracking table
2. Reads all `.sql` files from `db/migrations/`, sorted alphabetically
3. Skips already-executed migrations
4. Runs each pending migration in its own transaction (BEGIN/COMMIT, ROLLBACK on error)
5. Records execution in `schema_migrations` within the same transaction

**File naming**: `NNN_description.sql` (e.g., `001_create_users.sql`)

### ID System

Prefixed VARCHAR(20) IDs instead of UUIDs:
- `U` + random bigint = users (e.g., `U4829173650284`)
- `T` + random bigint = guests (e.g., `T7391028374651`)
- `G` + random bigint = games (e.g., `G5820174639281`)

Benefits: smaller (8 bytes vs 16), instant type recognition, better debugging.

## Startup Flow

```
dotenv → initDatabases() → Redis connect → PostgreSQL test → app.listen()
```

`initDatabases()` is called before Express starts listening. If either database connection fails, the app does not start.

## Error Handling

Consistent `{ success, data, error }` pattern at every layer:

| Layer | Pattern |
|-------|---------|
| Repository | Catches PG constraint errors → returns error codes |
| Service | Checks repo result, adds business errors (`NOT_YOUR_TURN`, `GAME_ALREADY_FULL`) |
| Route | Maps error codes to HTTP status + message |
| WebSocket | Emits `error` event to sender only |

## Logging

| System | Purpose | When |
|--------|---------|------|
| `debug` (`utils/debug.mjs`) | Dev-time tracing | `DEBUG=app:*` env var |
| Pino (`utils/logger.mjs`) | Structured production logs | Always |

**Debug namespaces**: `app:db:*`, `app:routes:*`, `app:services:*`, `app:repo:*`, `app:ws`, etc.

**Pino modes**: `PINO=compact` (dev default), `PINO=verbose` (with request IDs), JSON (production default).

**Request logger** (`utils/request_logger.mjs`): pino-http wrapper. Static assets logged at `trace`, errors at `error`, normal requests at `info`. Includes `subjectId` and `subjectType` from session.

## Conventions

- Public exports first, private helpers last (separated by `// --- Private Helpers ---`)
- Private helpers use leading underscore (`_helperName`)
- One router per resource: `src/routes/{resource}.mjs`
- All SQL uses parameterized queries (`$1, $2`)
- Soft deletes (`is_deleted` flag) — no hard deletes
