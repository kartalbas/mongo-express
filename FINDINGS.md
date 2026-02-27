# Mongo Express — Codebase Analysis Findings

**Date:** 2026-02-27
**Version:** 1.1.0-rc-3
**Branch:** development

---

## Fixed Issues

### FIX-001: Create and Delete buttons inconsistent width on database view

- **File:** `lib/views/database.html`
- **Status:** Fixed
- **Description:** On the database/collections page (`/db/<name>/`), the "+ Create" button had `min-width:6rem` but the "Delete" buttons had no min-width at all, causing visual inconsistency.
- **Fix:** Set both buttons to `min-width:7rem` for consistent sizing across the row.

### FIX-002: Pagination missing First and Last page buttons

- **File:** `lib/scripts/collection.js`
- **Status:** Fixed
- **Description:** The collection view pagination only had Previous (`«`) and Next (`»`) buttons. Users with many pages (e.g. 244,788 results) had no way to jump directly to the first or last page.
- **Fix:** Added First (`««`) and Last (`»»`) buttons to `renderPaginator()`. Both buttons are disabled when already on the first/last page respectively. Tooltips added to all navigation buttons.

### FIX-003: Login page broken UI when accessed via deep link

- **Files:** `lib/router.js`, `lib/views/layout.html`, `lib/views/login.html`
- **Status:** Fixed
- **Description:** When accessing a deep link like `/db/wegashop/` without being authenticated, the login page rendered with a broken/unstyled UI. The navbar (Monitoring, Replication, disconnect button) was visible behind the login form, and CSS wasn't loading because `baseHref` was not passed to the template.
- **Root Cause:** Both `res.render('login', ...)` calls in `router.js` were missing `baseHref` (needed by `layout.html` for CSS/asset paths). The full navbar was also rendering on the login page unnecessarily.
- **Fix:**
  1. Added `baseHref` and `isLoginPage: true` to both login render calls in `router.js`
  2. Wrapped navbar in `layout.html` with `{% if not isLoginPage %}` to hide it on login
  3. Updated login wrapper CSS to use `min-height: 100vh` (no longer needs navbar offset)

### FIX-004: 59 ESLint errors in collection.js

- **Files:** `lib/scripts/collection.js`, `eslint.config.js`
- **Status:** Fixed
- **Description:** `collection.js` had 53 pre-existing lint errors + 6 from the pagination feature addition. Errors included `appendChild` vs `append`, `getElementById` vs `querySelector`, `forEach` vs `for...of`, missing `ME` global declaration, and more.
- **Fix:** Applied all auto-fixes (49) and manually resolved remaining 10 errors. Added `ME: 'readonly'` to `eslint.config.js` globals. All 59 errors resolved, 0 remaining.

### FIX-005: Documents per page fixed at 10, no way to change

- **Files:** `lib/routes/collection.js`, `lib/views/collection.html`, `lib/scripts/collection.js`
- **Status:** Fixed
- **Description:** The collection view was hardcoded to show only `documentsPerPage` (default 10) documents. Users with large collections (e.g. 244,788 rows) had no way to increase the page size from the UI.
- **Fix:**
  1. Added a page-size dropdown selector (10, 30, 50, 100, 500, 1000) next to both top and bottom paginators
  2. Server accepts `limit` query parameter, validated against an allowlist of sizes (`ALLOWED_LIMITS`)
  3. Selection is saved to `localStorage` (`me_docs_per_page`) and automatically restored on next visit
  4. Changing the page size resets to page 1 to avoid out-of-range skip values

### FIX-006: Dark theme flash on page load

- **Files:** `lib/views/layout.html`, `lib/scripts/vendor.js`
- **Status:** Fixed
- **Description:** When dark theme was selected, a brief flash of light theme was visible on page load because theme was applied via Alpine.js `init()` which runs after body renders.
- **Fix:** Applied theme via inline `<script>` in `<head>` before first paint. Changed navbar to Bootstrap 5.3 theme-aware `bg-body-tertiary` class.

### FIX-007: ReDoS risk in collection query regex (S-01)

- **File:** `lib/routes/collection.js`
- **Status:** Fixed
- **Description:** User-controlled regex in collection query filters (`new RegExp(value, 'i')`) had no escaping of metacharacters, allowing ReDoS attacks.
- **Fix:** Added `replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw\`\\$&\`)` to escape all regex metacharacters before passing to `new RegExp()`.

### FIX-008: CSRF cookie secure flag hardcoded to false (S-03)

- **File:** `lib/router.js`
- **Status:** Fixed
- **Description:** CSRF cookie had `secure: false` hardcoded, making it vulnerable to downgrade attacks when HTTPS is in use.
- **Fix:** Changed to `secure: config.site.sslEnabled` so the cookie is marked secure when SSL is enabled.

### FIX-009: Fragile password masking in connection string (S-04)

- **File:** `lib/db.js`
- **Status:** Fixed
- **Description:** Password masking regex `/(mongo.*?:\/\/.*?:).*?@/` may not cover all MongoDB URI formats.
- **Fix:** Replaced with `URL` API parsing — `new URL(connectionString)` and setting `.password = '****'`, with regex fallback.

### FIX-010: Missing early returns in database.js error handlers (E-01)

- **File:** `lib/routes/database.js`
- **Status:** Fixed
- **Description:** `addDatabase`, `deleteDatabase`, and `viewDatabase` used `.then().catch()` chains where errors didn't prevent subsequent code from executing.
- **Fix:** Refactored all three handlers to use `async/await` with `try/catch` and proper early `return` statements. Also removed dead commented-out code (Q-01).

### FIX-011: MongoDB errors exposed to frontend (E-02)

- **File:** `lib/routes/collection.js`, `lib/routes/gridfs.js`
- **Status:** Fixed
- **Description:** Raw `error.message` and `error.toString()` were sent to users via session flash messages, potentially leaking database structure/internals.
- **Fix:** Replaced all raw error messages with context-specific safe messages (e.g. "Failed to create index.", "Failed to delete collection."). Raw errors are still logged to server console for debugging.

### FIX-012: GridFS fragile setTimeout timing (E-03)

- **File:** `lib/routes/gridfs.js`
- **Status:** Fixed
- **Description:** Upload completion used `setTimeout(500ms)` before redirecting — a fragile timing hack. File deletion also used `setTimeout`.
- **Fix:** Removed all `setTimeout` calls. Redirect directly in the `finish` event handler. Also fixed `req.session.error(...)` bug (was calling error as a function instead of assigning a string) in `addBucket`, `deleteBucket`, and `renameBucket`.

### FIX-013: Silent serverStatus failure (E-04)

- **File:** `lib/routes/index.js`
- **Status:** Fixed
- **Description:** `serverStatus()` failure was only logged to console; user saw no indication of connection issues.
- **Fix:** Set `req.session.error` with a user-friendly message so it appears as a flash alert on the homepage.

### FIX-014: Empty password not validated (L-03)

- **File:** `lib/router.js`
- **Status:** Fixed
- **Description:** Empty password submission was treated as "unchanged" (keeping the previous password) instead of being explicitly handled.
- **Fix:** Added explicit check: empty password now sets `connection.password = ''` instead of silently keeping the old value.

### FIX-015: Insecure TLS default (Q-04)

- **File:** `config.default.js`
- **Status:** Fixed
- **Description:** `tlsAllowInvalidCertificates` defaulted to `true`, which is insecure for production.
- **Fix:** Changed default to `false`. Users can still override via `ME_CONFIG_MONGODB_TLS_ALLOW_CERTS=true` environment variable.

### FIX-016: Shell command parsing hardened (S-02)

- **File:** `lib/routes/shell.js`
- **Status:** Fixed
- **Description:** Regex-based shell command parsing was loose, could allow unexpected inputs.
- **Fix:**
  1. Added `MAX_COMMAND_LENGTH` (10,000 chars) input size limit
  2. Tightened collection/method regex to only allow safe identifiers (`[A-Z_a-z]\w{0,120}`)
  3. Added JSON object type validation for `db.runCommand()` argument
  4. Sanitized error responses (no longer exposes raw `error.message`)
  5. Extracted `MAX_CURSOR_RESULTS` constant for find() limit

### FIX-017: Per-request file size validation on import (S-05)

- **File:** `lib/routes/collection.js`
- **Status:** Fixed
- **Description:** File import only relied on the global 50MB middleware limit with no per-request validation.
- **Fix:** Added `MAX_IMPORT_FILE_SIZE` (16 MB) constant and total file size check before processing. Returns HTTP 413 if exceeded.

---

## Open Issues

### MEDIUM — Race Conditions & Logic

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| L-01 | Global state update without locking | `lib/db.js:29-73` | `updateDatabases()` modifies global state — concurrent requests can corrupt the collection list. |
| L-02 | updateDatabases on every request | `lib/router.js:261-265` | Called per-request, causing both performance overhead and consistency risk. |

### MEDIUM — Test Coverage Gaps

| # | Gap | Description |
|---|-----|-------------|
| T-01 | Query/regex injection | No tests for malicious regex patterns in collection queries. |
| T-02 | Concurrent requests | No tests for race conditions on shared global state. |
| T-03 | CSRF validation | No tests verifying CSRF tokens are properly enforced. |
| T-04 | File upload limits | No tests for oversized file uploads or malformed imports. |
| T-05 | Session timeout | No tests for expired/invalid session handling. |
| T-06 | Shell injection | No tests for shell command bypass attempts. |

### LOW — Code Quality

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| Q-02 | Small schema sample | `lib/routes/collection.js:679-737` | Schema analysis only samples 100 docs with 3 samples per field — may not represent actual schema. |
| Q-03 | Hard-coded result limits | `lib/routes/shell.js` | Shell find/aggregate hard-coded to 100 results, not configurable. |

### LOW — Missing Features

| # | Feature | Description |
|---|---------|-------------|
| F-01 | Transaction support in shell | Shell has no ability to run operations within a transaction. |
| F-02 | Abort long-running commands | No mechanism to cancel a long-running shell command. |
| F-03 | Schema analysis metrics | No performance stats or confidence level for large collection schema inference. |

---

## Architecture Notes

- **Backend:** Node.js ESM, Express 4, Nunjucks templating
- **Frontend:** Alpine.js + htmx, Bootstrap 5, CodeMirror editor, Webpack bundled
- **Database:** MongoDB driver 6.x with BSON support
- **Auth:** Basic Auth, OpenID Connect (optional), per-session MongoDB credentials
- **Tests:** Mocha + Chai + Supertest (unit/integration), Cypress (E2E)
- **Docker:** node:22-alpine, multi-stage build with Yarn workspaces
