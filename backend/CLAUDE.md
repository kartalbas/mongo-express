# Backend Architecture Rules

## Core Principles
- **JSON-only API** — never render HTML, never use template engines
- **TypeScript strict mode** — no `any`, no `as` casts unless absolutely necessary
- **Stateless where possible** — sessions only for auth; every other request is self-contained

## Project Structure
- `src/routes/` — Express route handlers. One file per resource domain.
- `src/middleware/` — Reusable Express middleware. Each file exports a single middleware function.
- `src/services/` — Business logic and external integrations (MongoDB, etc.). No Express types here.
- `src/types/` — TypeScript interfaces and type definitions. Shared across the project.

## Unified Response Model (MANDATORY)
Every endpoint returns the same JSON shape — no exceptions:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  notification: {
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;  // pre-translated via Accept-Language
  } | null;
}
```
- Use `sendResponse(res, statusCode, data, notification)` from `src/i18n/index.ts`
- Never call `res.json()` directly — always use `sendResponse()`
- Notification messages must be translated via `t(lang, key)` before sending

## Route Handler Rules
- Every route handler is an async function that returns via `sendResponse()`
- Errors are thrown (or passed to `next()`) and caught by the global error handler
- Request validation uses zod schemas defined alongside the route
- Response types are explicitly defined in `src/types/index.ts`

## Error Handling
- All errors return unified `ApiResponse` with `success: false` and notification
- Use standard HTTP status codes (400, 401, 403, 404, 500)
- Never expose stack traces in production

## i18n
- Translation files: `src/i18n/en.json`, `src/i18n/de.json` with `be.*` keys
- Language detection: `getLang(req)` parses `Accept-Language` header
- Translation: `t(lang, key)` for dot-path lookup (e.g. `t(lang, 'be.auth.loginSuccess')`)
- All user-facing strings must use `t()` — no hardcoded messages in route handlers
- No heavy i18n library — just JSON + dot-path resolution

## Auth
- Simple username/password authentication — no Basic Auth, no OIDC
- Users stored in SQLite (`/data/monko.db`) with bcrypt-hashed passwords
- Auth middleware runs before all /api/* routes except /api/auth/login, /health
- Session-based: express-session with signed cookies
- CSRF: double-submit cookie pattern via csrf-csrf
- On first startup: auto-seed admin user (admin/admin, must_change_password=true)

## Data Storage
- **MongoDB** — read/managed data only (the databases the user is administrating)
- **SQLite** — app's own data: users, settings, preferences. Stored at `MONKO_DATA_DIR/monko.db`
- SQLite migrations run on startup (`src/db/migrations/`)
- Use `node-sqlite3-wasm` — SQLite compiled to WASM, zero native compilation needed. Works on Windows/Linux/macOS, ARM/Intel, no python/make/g++ required. Synchronous API, real file system access.
- Never store app management data in MongoDB

## Environment Variables
- `ME_CONFIG_MONGODB_URL` — MongoDB connection string (same K8s secret as monolith)
- `MONKO_DATA_DIR` — SQLite database directory (default: `/data`, mapped to PVC in K8s)
- `MONKO_SESSION_SECRET` — Session cookie secret
- `MONKO_CORS_ORIGIN` — Frontend origin for CORS (e.g., `https://monko.prod.wegacell.de`)
- `PORT` — Backend port (default: `3000`)
- All config parsed/validated at startup in `src/config.ts`

## Dependencies
- Express 4, mongodb 6, bson 6, node-sqlite3-wasm, bcryptjs (pure JS, no native), zod, csrf-csrf, express-session, cors
- No ORM — direct SQLite and MongoDB driver usage
- No frontend dependencies whatsoever
