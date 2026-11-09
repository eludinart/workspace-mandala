# Task 3 Report: Brancher Layout

## Status
**Done**

## Commit
- `feat(pull-refresh): brancher PullToRefresh sur le Layout` (only `next/src/components/layout/Layout.tsx`)

## Summary
- Added `import { PullToRefresh } from '@/components/PullToRefresh'`.
- Non-messages branch: `<main>` is now `flex flex-col` without `overflow-auto`; scroll moved to `PullToRefresh` with `className` `flex-1 overflow-auto` and padding `p-0` (home) vs `p-4 md:p-6` (other pages).
- `page === 'messages'` branch unchanged: `main` remains `overflow-hidden`, no `PullToRefresh`.

## Verification
- `npx tsc --noEmit` in `next/` — exit 0.

## Self-review
- Matches task brief structure; `page` passed through to `PullToRefresh`.
- Main outer padding on non-home is `p-0` on both branches of the ternary (per spec); effective page padding is on `PullToRefresh` only — intentional per brief.
- Messages excluded as required; scroll ref now lives on `PullToRefresh` inner div (hook attaches there).

## Concerns
- None blocking. Soft refresh handlers (Tasks 4–6) not wired yet; hard reload fallback expected until then.
- Redundant `page === 'home' ? 'p-0' : 'p-0'` on `<main>` could be simplified later; kept to match brief literally.
