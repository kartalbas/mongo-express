# Frontend Architecture Rules

## Core Principles
- **Component-based architecture** with three tiers:
  1. **Unit Components** (`components/ui/`, `components/form/`, `components/feedback/`)
     — Atomic, reusable, zero business logic. Only receive props. No API calls.
  2. **Constructed Components** (`components/layout/`, `components/monitoring/`, etc.)
     — Compose unit components. May have local state. May call hooks. Domain-specific.
  3. **Pages** (`pages/`)
     — Compose constructed components. Handle routing. Minimal logic.
- **No browser native dialogs** — never use `alert()`, `confirm()`, `prompt()`, or browser
  form validation (`required`, `pattern` attributes). Use our custom components instead:
  - `ConfirmDialog` instead of `confirm()`
  - `Sonner` toasts instead of `alert()`
  - `FormField` + `FormError` instead of browser validation
- **Consistent form patterns** — all form inputs use `FormField` wrapper which provides:
  - Label with optional required indicator
  - Input component (text, password, select, etc.)
  - Inline error message below the field
  - Validation via zod schemas, triggered on blur and submit
  - No `noValidate` hacks — we simply don't use HTML validation attributes

## Unified Response Model (MANDATORY)
Every backend endpoint returns the same JSON shape:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  notification: {
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;  // pre-translated by backend
  } | null;
}
```
- Frontend receives pre-translated notification `message` — display as-is via Sonner toast
- Check `notification.show` before displaying; some responses are silent
- Access actual data via `response.data`, not the top-level response object

## i18n
- Library: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Translation files: `src/i18n/en.json`, `src/i18n/de.json` with `fe.*` keys only
- Usage: `useTranslation()` hook → `t('fe.login.title')`
- Notifications: backend sends pre-translated `message`, frontend just shows it
- Zod validation: factory functions `createLoginSchema(t)` receive `t` so messages are translated at render time
- Import `src/i18n/index.ts` in app entry point to initialize

## Form Validation
- Define validation schemas as factory functions in `lib/validation.ts` (e.g. `createLoginSchema(t)`)
- Factory functions receive `t` from `useTranslation()` so error messages are translated
- Use `react-hook-form` with `@hookform/resolvers/zod` for form state
- Errors display inline below each field via `FormError` component
- Submit button shows loading state via `FormSubmitButton`
- Server errors (401, 422) are mapped to field-level or form-level errors

## Styling
- **Tailwind CSS** for all styling — no inline styles, no CSS modules, no styled-components
- **shadcn/ui** for base components — customize via CSS variables in `globals.css`
- **Dark mode** via Tailwind `class` strategy on `<html>` element
- **No Bootstrap** — even during migration, frontend is pure Tailwind
- Color tokens defined as CSS variables (shadcn pattern):
  `--background`, `--foreground`, `--primary`, `--muted`, etc.

## State Management
- **TanStack Query** for all server state (fetching, caching, mutations)
- **React state** (`useState`, `useReducer`) for local UI state only
- **No global state library** (no Redux, no Zustand) — if needed, use React Context
- **localStorage** only for theme preference (`bsTheme` key)

## API Layer
- All API calls go through `api/client.ts` which handles:
  - Base URL prefixing (`/api/`)
  - CSRF token from `/api/auth/csrf` (cached, refreshed on 403)
  - Session cookie (automatic via `credentials: 'include'`)
  - JSON parsing and error extraction
- Query hooks in `api/queries/` use TanStack Query's `useQuery`/`useMutation`
- Never call `fetch()` directly in components — always use a query hook

## File Naming
- Components: PascalCase (`MetricsCards.tsx`)
- Hooks: camelCase with `use` prefix (`useDarkMode.ts`)
- Utilities: camelCase (`validation.ts`)
- One component per file (except tiny related components)

## Testing (future)
- Unit tests for unit components with React Testing Library
- Integration tests for pages with MSW (Mock Service Worker)
- No snapshot tests — they provide false confidence

## Dependencies
- React 19, React Router 7, TanStack Query 5
- Vite 6, TypeScript 5, Tailwind CSS 4
- shadcn/ui (Radix primitives), Lucide React (icons), Sonner (toasts)
- react-hook-form + @hookform/resolvers + zod (forms)
- No jQuery, no Bootstrap, no Alpine.js, no htmx
