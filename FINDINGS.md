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

---

## Open Issues

### HIGH — Security

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| S-01 | ReDoS risk | `lib/routes/collection.js` | User-controlled regex in collection query filters (`new RegExp(value, 'i')`) with no escaping of metacharacters. |
| S-02 | Shell command parsing is loose | `lib/routes/shell.js:53-90` | Regex-based parsing of shell commands could allow unexpected inputs past the whitelist. |
| S-03 | CSRF cookie `secure: false` | `lib/router.js:132` | Vulnerable to downgrade attacks when HTTPS is expected. |
| S-04 | Fragile password masking | `lib/router.js:93` | Connection string password masking regex may not cover all MongoDB URI formats. |
| S-05 | No per-request file size limit | `lib/routes/collection.js:758-812` | File upload only relies on middleware global 50MB limit, no per-request validation. |

### HIGH — Error Handling

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| E-01 | TODO error handlers | `lib/routes/database.js:53,68,74,85` | Database create/delete operations don't return early after errors, execution continues. |
| E-02 | MongoDB errors exposed to frontend | `lib/routes/collection.js` (multiple) | Raw error messages could leak database structure to users. |
| E-03 | GridFS fragile timing | `lib/routes/gridfs.js:64-69` | Upload completion uses `setTimeout(500ms)` — a fragile timing hack instead of proper async handling. |
| E-04 | Silent serverStatus failure | `lib/routes/index.js:117` | `serverStatus()` error only logged to console, user sees no indication of connection issues. |

### MEDIUM — Race Conditions & Logic

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| L-01 | Global state update without locking | `lib/db.js:29-73` | `updateDatabases()` modifies global state — concurrent requests can corrupt the collection list. |
| L-02 | updateDatabases on every request | `lib/router.js:261-265` | Called per-request, causing both performance overhead and consistency risk. |
| L-03 | Empty password not validated | `lib/router.js:203-204` | Empty password submission treated as "unchanged" instead of being rejected. |

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
| Q-01 | Dead code | `lib/routes/database.js:65-72` | Commented-out code for dropping auto-created collection. |
| Q-02 | Small schema sample | `lib/routes/collection.js:679-737` | Schema analysis only samples 100 docs with 3 samples per field — may not represent actual schema. |
| Q-03 | Hard-coded result limits | `lib/routes/shell.js` | Shell find/aggregate hard-coded to 100 results, not configurable. |
| Q-04 | Insecure TLS default | `config.default.js:81` | `tlsAllowInvalidCertificates` defaults to `true` — insecure for production. |

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
