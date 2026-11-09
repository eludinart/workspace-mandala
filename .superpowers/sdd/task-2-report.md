# Task 2 Report — Hook d’enregistrement + hook geste + composant

## Status

**DONE** — All three files created, typecheck PASS, committed on `feat/pull-to-refresh`.

## Commit

- `8f9f34b` — `feat(pull-refresh): hook geste et composant PullToRefresh`

## Files created

| File | Purpose |
|------|---------|
| `next/src/hooks/useRegisterPullRefresh.ts` | `useEffect` wrapper around `registerPullRefreshHandler(page, handler)` |
| `next/src/hooks/usePullToRefresh.ts` | Touch gesture: rubber-band, threshold 70px, horizontal cancel, `showError` |
| `next/src/components/PullToRefresh.tsx` | UI wrapper: `runPullRefresh`, hard reload, error `Impossible de rafraîchir` |

## Typecheck

```text
cd next && npm run typecheck  →  exit 0 (tsc --noEmit)
```

## Self-review

### Spec compliance

- Error string exactly: `Impossible de rafraîchir` ✓
- Spinner uses `border-accent` (token exists in `Layout.tsx`) ✓
- Consumes Foundation APIs from `pull-refresh.ts` ✓
- `usePullToRefresh` returns `{ scrollRef, pullDistance, refreshing, errorMessage, showError }` ✓
- `PullToRefresh` props: `page`, `children`, `className`, `disabled` ✓

### Behavior notes

1. **`onEnd` + `refreshing` in closure**: `setPullDistance` callback checks `!refreshing` before calling `run()`. Because `refreshing` is in the effect dependency array, listeners re-bind when refresh starts — acceptable; threshold path typically fires before `refreshing` flips true.

2. **`soft-error` path**: `onRefresh` throws `Error('soft-error')`; outer `usePullToRefresh` callback catches any error and shows the French message — correct for both thrown soft-error and other failures.

3. **`hard` pages**: `window.location.reload()` — no error UI (navigation).

4. **Desktop**: `isPullToRefreshUiEnabled()` gates listeners — no PTR on fine-pointer desktop.

5. **Not wired yet**: Component/hooks are standalone; Task 3+ likely integrates into page layouts.

### Concerns (minor)

- Scroll container is the outer `div` with `scrollRef`; parent must allow overflow scroll if content exceeds viewport — integration task should set `overflow-y-auto` / flex min-h-0 as needed.
- `showError` is returned from hook but only used internally via `PullToRefresh` — API surface matches brief.

## Next steps (out of scope for Task 2)

- Wire `PullToRefresh` around page content in `MandalaApp` / layouts.
- Register soft handlers per page with `useRegisterPullRefresh`.
