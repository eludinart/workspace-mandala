# Task 1 Report: Mapping soft/hard + registry

## Status

**DONE**

## Summary

Created `next/src/lib/pull-refresh.ts` and `next/src/lib/pull-refresh.test.ts` on branch `feat/pull-to-refresh`. The module defines soft vs hard `MandalaPage` classification, a per-page handler registry with unsubscribe, `runPullRefresh` with `soft-ok` / `soft-error` / `hard` outcomes, `PULL_REFRESH_THRESHOLD_PX = 70`, and `isPullToRefreshUiEnabled()` for mobile-only UI (SSR-safe).

## Files created

| File | Purpose |
|------|---------|
| `next/src/lib/pull-refresh.ts` | Exports, SOFT_PAGES set, handler registry, `runPullRefresh` |
| `next/src/lib/pull-refresh.test.ts` | node:test coverage for mapping + registry behavior |

## API (produced)

- `PULL_REFRESH_THRESHOLD_PX = 70`
- `isSoftPullRefreshPage(page: MandalaPage): boolean`
- `isPullToRefreshUiEnabled(): boolean`
- `registerPullRefreshHandler(page, handler): () => void`
- `runPullRefresh(page): Promise<'soft-ok' | 'soft-error' | 'hard'>`

## Soft pages (12)

`home`, `events`, `calendar`, `place-announcements`, `members`, `place-members`, `messages`, `notifications`, `resources`, `skills`, `directory`, `places-map`

All other `MandalaPage` values are hard (caller may `location.reload`).

## TDD Evidence

### RED — Step 2 (module missing)

**Command** (from `next/`):

```text
npx tsx --test src/lib/pull-refresh.test.ts
```

**Output**:

```text
Error: Cannot find module './pull-refresh'
  code: 'MODULE_NOT_FOUND',
...
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

### GREEN — Step 4 (implementation added)

**Command**:

```text
npx tsx --test src/lib/pull-refresh.test.ts
```

**Output**:

```text
▶ isSoftPullRefreshPage
  ✔ marks home/events/messages soft and admin/account hard
✔ isSoftPullRefreshPage
▶ runPullRefresh
  ✔ runs registered soft handlers
  ✔ returns soft-error when a handler throws
  ✔ returns hard when page is hard or soft has no handler
✔ runPullRefresh
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

## Commit

- **SHA:** `dc9e974`
- **Subject:** `feat(pull-refresh): mapping soft/hard et registre de handlers`

## Self-review

- Implementation matches task brief verbatim (SOFT_PAGES set, handler map, Promise.all, catch → `soft-error`, no handler / hard page → `hard`).
- `courses` in the “hard” test is not in SOFT_PAGES → `hard` without needing a registered handler (correct per spec).
- Unsubscribe removes handler and deletes empty page entries from the map.
- `isPullToRefreshUiEnabled` returns `false` when `window` is undefined (SSR); not unit-tested in this task (UI layer later).
- Import uses `@/components/MandalaApp` type only; no circular dependency risk for lib tests.
- Only the two files specified were created; no unrelated changes.

## Concerns

None.

## Handoff to later tasks

- Task 2+ can import `PULL_REFRESH_THRESHOLD_PX`, `isPullToRefreshUiEnabled`, and wire page components with `registerPullRefreshHandler`.
