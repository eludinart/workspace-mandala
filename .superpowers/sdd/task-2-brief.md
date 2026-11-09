### Task 2: Hook d’enregistrement + hook geste + composant

**Files:**
- Create: `next/src/hooks/useRegisterPullRefresh.ts`
- Create: `next/src/hooks/usePullToRefresh.ts`
- Create: `next/src/components/PullToRefresh.tsx`

**Interfaces:**
- Consumes: `registerPullRefreshHandler`, `PULL_REFRESH_THRESHOLD_PX`, `isPullToRefreshUiEnabled`, `runPullRefresh`
- Produces:
  - `useRegisterPullRefresh(page, handler)`
  - `PullToRefresh({ page, children, className, disabled? })`

- [ ] **Step 1: Implement `useRegisterPullRefresh`**

```ts
'use client'

import { useEffect } from 'react'
import type { MandalaPage } from '@/components/MandalaApp'
import { registerPullRefreshHandler } from '@/lib/pull-refresh'

export function useRegisterPullRefresh(
  page: MandalaPage,
  handler: () => Promise<void>,
): void {
  useEffect(() => registerPullRefreshHandler(page, handler), [page, handler])
}
```

- [ ] **Step 2: Implement `usePullToRefresh`**

Attach touch listeners on a scroll element ref. Logic:

- Ignore if `disabled` or `!isPullToRefreshUiEnabled()` or already `refreshing`
- `touchstart`: record `startY`, only if `el.scrollTop <= 0`
- `touchmove`: if pulling down (`clientY - startY > 0`) and still `scrollTop <= 0`, set `pullDistance = min(dy * 0.45, 120)` ; if `|dx| > |dy|` cancel (horizontal)
- `touchend` / `touchcancel`: if `pullDistance >= PULL_REFRESH_THRESHOLD_PX`, call `onRefresh()`, else animate distance to 0
- Return `{ scrollRef, pullDistance, refreshing, errorMessage }`

Exact skeleton:

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PULL_REFRESH_THRESHOLD_PX,
  isPullToRefreshUiEnabled,
} from '@/lib/pull-refresh'

export function usePullToRefresh(onRefresh: () => Promise<void>, disabled?: boolean) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const startY = useRef(0)
  const startX = useRef(0)
  const pulling = useRef(false)

  const run = useCallback(async () => {
    setRefreshing(true)
    setErrorMessage(null)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setPullDistance(0)
    }
  }, [onRefresh])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || disabled || !isPullToRefreshUiEnabled()) return

    const onStart = (e: TouchEvent) => {
      if (refreshing) return
      if (el.scrollTop > 0) {
        pulling.current = false
        return
      }
      const t = e.touches[0]
      startY.current = t.clientY
      startX.current = t.clientX
      pulling.current = true
    }

    const onMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return
      const t = e.touches[0]
      const dy = t.clientY - startY.current
      const dx = t.clientX - startX.current
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        pulling.current = false
        setPullDistance(0)
        return
      }
      if (el.scrollTop > 0 || dy <= 0) {
        setPullDistance(0)
        return
      }
      // Empêche le scroll natif pendant le rubber-band
      if (dy > 8) e.preventDefault()
      setPullDistance(Math.min(dy * 0.45, 120))
    }

    const onEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      setPullDistance((d) => {
        if (d >= PULL_REFRESH_THRESHOLD_PX && !refreshing) {
          void run()
          return d
        }
        return 0
      })
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [disabled, refreshing, run])

  const showError = useCallback((msg: string) => {
    setErrorMessage(msg)
    window.setTimeout(() => setErrorMessage(null), 2800)
  }, [])

  return { scrollRef, pullDistance, refreshing, errorMessage, showError }
}
```

- [ ] **Step 3: Implement `PullToRefresh`**

```tsx
'use client'

import { useCallback } from 'react'
import type { MandalaPage } from '@/components/MandalaApp'
import { runPullRefresh } from '@/lib/pull-refresh'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'

export function PullToRefresh({
  page,
  children,
  className = '',
  disabled = false,
}: {
  page: MandalaPage
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  const onRefresh = useCallback(async () => {
    const result = await runPullRefresh(page)
    if (result === 'hard') {
      window.location.reload()
      return
    }
    if (result === 'soft-error') {
      throw new Error('soft-error')
    }
  }, [page])

  const { scrollRef, pullDistance, refreshing, errorMessage, showError } = usePullToRefresh(
    async () => {
      try {
        await onRefresh()
      } catch {
        showError('Impossible de rafraîchir')
      }
    },
    disabled,
  )

  const indicatorVisible = pullDistance > 8 || refreshing

  return (
    <div ref={scrollRef} className={`relative min-h-0 ${className}`}>
      <div
        className="pointer-events-none sticky top-0 z-20 flex justify-center overflow-hidden"
        style={{ height: indicatorVisible ? Math.max(pullDistance, refreshing ? 40 : 0) : 0 }}
        aria-hidden={!indicatorVisible}
      >
        <div className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/90 border border-slate-700 shadow">
          <span
            className={`block h-4 w-4 rounded-full border-2 border-accent border-t-transparent ${
              refreshing || pullDistance >= 70 ? 'animate-spin' : ''
            }`}
          />
        </div>
      </div>
      {errorMessage && (
        <p className="sticky top-0 z-20 mx-auto mt-1 w-fit rounded-full bg-slate-900/95 px-3 py-1 text-xs text-rose-300 border border-rose-900/50">
          {errorMessage}
        </p>
      )}
      <div style={{ transform: pullDistance && !refreshing ? `translateY(${pullDistance}px)` : undefined }}>
        {children}
      </div>
    </div>
  )
}
```

Note: `border-accent` must match existing Mandala Tailwind accent token used elsewhere ; if absent, use `border-[rgb(var(--accent-400))]`.

- [ ] **Step 4: Typecheck**

```bash
cd next && npm run typecheck
```

Expected: PASS (or only pre-existing unrelated errors)

- [ ] **Step 5: Commit**

```bash
git add next/src/hooks/useRegisterPullRefresh.ts next/src/hooks/usePullToRefresh.ts next/src/components/PullToRefresh.tsx
git commit -m "feat(pull-refresh): hook geste et composant PullToRefresh"
```

---

