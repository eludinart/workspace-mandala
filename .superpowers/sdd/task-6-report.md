# Task 6 Report: Messages (liste + fil)

## Status
**DONE** — typecheck PASS

## Commits
- `71bca4f` — `feat(pull-refresh): Messages liste et fil` (`MessagesPage.tsx`, `DialogueStream.tsx`)

## Summary
- **MessagesPage**: `loadChannels({ soft: true })` on pull avoids toggling `loading` and blanking the channel list; `useRegisterPullRefresh('messages')` reloads channels then `loadChannelMessages` for the open channel via `selectedIdRef`.
- **List scroll**: wrapped with `<PullToRefresh page="messages">`; `disabled={chatOpen && listTab === 'dialogues'}` so on large screens with an open chat only the thread PTR is active.
- **DialogueStream**: message thread scroll wrapped with `PullToRefresh`; `getListScrollEl()` walks from `listAnchorRef` to the PTR scroll container so auto-scroll behavior still works without changing `PullToRefresh.tsx`.
- **Store**: `loadChannelMessages` already merges server + recent local messages (no pre-clear); no DialogueStream blanking change required.

## Concerns
- `getListScrollEl()` depends on `PullToRefresh` DOM shape (scroll on outer wrapper). If that component changes, thread scroll-to-bottom may need a follow-up.
- Two `PullToRefresh` instances share `page="messages"`; only one is enabled at a time on typical mobile; both can exist on `lg` but list PTR is disabled when a dialogue is open.

## Verification
- `npm run typecheck` in `next/` — exit 0
