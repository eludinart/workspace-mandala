# Task 5 report — Soft handlers (Agora, listes)

## Status

**Done** — typecheck passes (`npm run typecheck`).

## Commit

`b5f6a4e` — `feat(pull-refresh): soft handlers mur membres alertes listes`

## Summary

| Area | Mechanism |
|------|-----------|
| **AgoraFeed** | `mandala-pull-refresh` when `detail.page === 'home'` → `load({ soft: true })`; list stays visible while refreshing |
| **PlaceAnnouncementsSection** | Same home window event + soft `load` |
| **PlaceAnnouncementsPage** | `useRegisterPullRefresh('place-announcements', …)` |
| **MembersPage** | `members` + `place-members`; soft `loadCommunity` / `loadDirectory` by mode |
| **NotificationsPage** | `useRegisterPullRefresh('notifications', …)`; `fetchList(..., { soft: true })` |
| **PlacesMapPage** | `useRegisterPullRefresh('places-map', …)`; soft `loadPlaces` |
| **Resources** | `ResourceLibrary` + `pullRefreshPage="resources"` |
| **Skills / Directory** | `SkillsDirectory` + `pullRefreshPage` on `SkillsPage` / `DirectoryPage` (cards + map markers) |

### Pattern

- `load*(opts?: { soft?: boolean })` skips `setLoading(true)` when `soft` and UI gates on `loading && items.length === 0`.
- Home sections use Pattern B (window event); full pages use `useRegisterPullRefresh`.
- Skills/resources already used `refreshing`; pull reuses existing `load()` / `loadMap()`.

## Concerns

- **Members directory pull**: if annuaire élargi is closed, pull still refreshes community list only (expected).
- **Dual register on MembersPage**: both `members` and `place-members` register the same handler while mounted — harmless when only one route is active; if both handlers ever ran together, would duplicate fetch (unlikely).
- **NotificationContext** `fetchList` signature extended with optional second arg; callers unchanged except NotificationsPage pull.

## Files touched

13 files under `next/src/` (components, views, NotificationContext).

## Review fixes (Task 5 findings)

- **places-map**: `DiscoverWallPage` registers `useRegisterPullRefresh('places-map', …)` and dispatches `mandala-pull-refresh` with `page: 'places-map'`. `WallDiscoverSection` + `WallFeed` listen and soft-refetch map/places and wall feed without blanking. Removed dead `PlacesMapPage` registration (view not mounted in `MandalaApp`).
- **MembersPage `loadDirectory`**: `if (!soft) setDirectoryLoading(true)`; `useCallback` deps `[]` (no `directoryMembers.length`).
