# KMA App — AI Coding Agent Instructions

## Architecture Overview

**Clean Architecture + Feature-Sliced Design** for an offline-first iOS auditing app (React Native + Expo).

### Layer Separation

- **`src/entities/`**: Pure domain models + ports (NO React Native, NO axios)
  - Example: [user/ports.ts](../src/entities/user/ports.ts) defines `UserSessionRepo` and `AuthService` interfaces
- **`src/features/`**: Vertical slices with `ui/`, `application/`, `lib/`
  - Each feature exports public API via `index.ts`
  - Never call axios directly from UI; use repo/use case patterns
- **`src/processes/`**: Cross-feature orchestrators
  - [bootstrap](../src/processes/bootstrap/index.ts): DB init, session rehyd, background worker registration
  - [sync](../src/processes/sync/SyncService.ts): Outbox-based sync with exponential backoff
- **`src/core/`**: Infrastructure (HTTP client, SQLite repos, error handling)
  - [http.ts](../src/core/http/http.ts): Axios instance with auth interceptor + 401 refresh + retry logic
- **`src/shared/`**: Cross-cutting utilities (UI atoms, storage, config, validation)

### Critical Path Aliases

Always use these (never relative imports for cross-layer):

```typescript
@app/*        // Expo Router screens
@entities/*   // Domain models/ports
@features/*   // Feature slices
@processes/*  // Orchestrators
@core/*       // Infrastructure
@shared/*     // Utils/UI/config
```

## Offline-First Pattern (Outbox)

1. **Write operations** → save locally to SQLite + enqueue in `outbox` table
2. **SyncService** ([SyncService.ts](../src/processes/sync/SyncService.ts)) processes queue:
   - Triggered by: network reconnect, app foreground, background task
   - Exponential backoff on retry; drops item on permanent error
3. **Cleanup**: Delete local files only after backend confirms 2xx
4. **Idempotency**: Each outbox item has UUID; backend deduplicates by `Idempotency-Key` header

## Key Technical Decisions

- **TypeScript**: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Forms**: `react-hook-form` + `zod` for dynamic JSON-driven forms
  - See [DynamicForm.tsx](../src/features/dynamic-form/ui/DynamicForm.tsx)
- **DB**: `expo-sqlite` with WAL mode, migrations in [storage/migrations](../src/shared/storage/db.ts)
- **Secrets**: `expo-secure-store` for tokens (NEVER in SQLite)
- **HTTP retries**: Handled in [http.ts](../src/core/http/http.ts) (429/5xx only, NOT 4xx)
- **Auth**: Bearer token auto-injected; 401 triggers single refresh attempt via queue

## Development Workflow

```bash
# Type check before commit
pnpm typecheck

# Local dev with backend override
pnpm dev:ios  # uses http://127.0.0.1:3001

# Standard dev
pnpm ios

# Build for TestFlight
pnpm build:ios
```

## Common Patterns

### Adding a New Feature

1. Create `src/features/<feature-name>/` with `ui/`, `application/`, `index.ts`
2. Define domain model in `src/entities/<domain>/` if needed
3. Implement repo adapter in `src/core/repos/` for any persistence
4. Expose public API via feature's `index.ts` (never import internals from other features)

### Offline Operation

```typescript
// ✅ Correct: Enqueue + save locally
await outboxRepo.enqueue({ id: uuid(), type: 'AUDIT_SUBMISSION', payload })
await submissionRepo.saveLocal(data)

// ❌ Wrong: Direct HTTP call from UI
await axios.post('/audits', data)
```

### Auth-Protected Routes

Use [processes/auth-guard](../src/processes/auth-guard/) pattern. Example: `app/(app)/_layout.tsx` checks session before rendering.

## Testing Strategy

- **Unit**: Pure functions in `entities/` and `shared/lib/`
- **Integration**: Features with in-memory repo implementations
- **E2E**: Detox for `login → capture photo → offline → sync` flow

## Gotchas

- **Never** add React Native imports in `entities/` (breaks domain purity)
- **Never** bypass `http.ts` client for backend calls (loses auth/retry/idempotency)
- **Background fetch** on iOS is best-effort; primary sync triggers are foreground + network state
- Multipart uploads use presigned URLs from `/uploads` endpoint; binary PUT goes direct to S3 (no auth header)

## More Context

See [AGENTS.md](../AGENTS.md) for exhaustive architecture rationale and feature specs.
