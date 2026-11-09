# Task 4 Report — Soft handlers (Home / Events / Calendar)

## Status
**Done** — commit `0abf327` on `feat/pull-to-refresh`.

## Changes

| File | Page key | Behavior |
|------|----------|----------|
| `HomePage.tsx` | `'home'` | `refreshCommunities({ background: true })`, `invalidateQueries(placeEvents)`, `mandala-pull-refresh` event |
| `EventsPage.tsx` | `'events'` | Same without custom event |
| `CalendarPage.tsx` | `'calendar'` | Same + `loadData({ background: true })` + `openDay(selectedDay)` when day panel open |

### Calendar `loadData` background mode
`loadData` accepts optional `{ background?: true }` so pull-to-refresh updates month/week grid without `setLoading(true)` or clearing `data` on failure.

## Self-review

- Handlers use stable `useCallback` + `useRegisterPullRefresh`.
- Soft refresh: React Query invalidation keeps cached events visible while refetching; calendar background load preserves existing `data`.
- Home dispatches `mandala-pull-refresh` for downstream sections (Task 5).

## Typecheck

`cd next && npm run typecheck` — **PASS** (exit 0, `tsc --noEmit`).

## Fix — review scope creep (EventsPage)

Commit `0abf327` accidentally included CreateEventWizard calendar-day opening (`enumerateEventDays`, `calendarApi.setDays`, checkbox + recap UI). Reverted those hunks to match parent `ba6f2eb`; kept only pull-refresh (`useCallback`, `useQueryClient`, `queryKeys`, `onPull`, `useRegisterPullRefresh('events', …)`).

Follow-up commit: `42a8351` — `fix(pull-refresh): retirer scope creep wizard EventsPage`.

## Concerns

1. Day panel on calendar pull still sets `detailLoading` via `openDay` — acceptable for open-day detail, not the main grid list.
2. Home sections (Agora, annonces, etc.) only refresh after they listen to `mandala-pull-refresh` (Task 5).

## Verification (manual)

- Pull on Accueil / Événements / Calendrier with active lieu → data refetches without full-page skeleton.
- Switch lieu → handlers pick up new `active.slug` via deps.
