# Pull-to-refresh mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Geste pull-to-refresh sur smartphone : soft refetch des écrans chauds, hard reload ailleurs, y compris Messages.

**Architecture:** Mapping soft/hard pur + registre de handlers soft ; composant `PullToRefresh` sur le scroll de `Layout` et sur Messages ; les écrans soft s’enregistrent via `useRegisterPullRefresh` ; sans lib externe ; shell `overscroll-behavior: none` inchangé.

**Tech Stack:** Next 15, React 18, TanStack Query (événements), CustomEvent bus existant, `node:test` + `tsx` pour tests unitaires.

## Global Constraints

- Spec : `docs/superpowers/specs/2026-11-08-pull-to-refresh-design.md`
- Geste : tirer vers le bas uniquement si `scrollTop === 0` ; seuil **70px**
- Soft vs hard : table de la spec ; pas de handler soft → **fallback hard** (`location.reload()`)
- Soft en échec → message discret « Impossible de rafraîchir » ; **pas** de reload forcé
- Desktop fin (`min-width: 768px` + `pointer: fine` + `hover: hover`) : geste **désactivé**
- Pas de lib pull-to-refresh ; ne pas modifier `overscroll-behavior` global sur `html`/`body`
- Vocabulaire UI : français produit Mandala ; message d’erreur exact : `Impossible de rafraîchir`

---

## File map

| File | Responsibility |
| --- | --- |
| `next/src/lib/pull-refresh.ts` | Soft/hard mapping, registry handlers, `runPullRefresh`, UI enable helper |
| `next/src/lib/pull-refresh.test.ts` | Tests unitaires mapping + registry |
| `next/src/hooks/useRegisterPullRefresh.ts` | Enregistre un handler soft pour une page (cleanup unmount) |
| `next/src/hooks/usePullToRefresh.ts` | Listeners touch + état pull (distance, refreshing) |
| `next/src/components/PullToRefresh.tsx` | Conteneur scroll + indicateur + wire hook |
| `next/src/components/layout/Layout.tsx` | Enveloppe `<main>` avec `PullToRefresh` |
| Soft screens + Messages | `useRegisterPullRefresh` / wrap scroll Messages |

---

### Task 1: Mapping soft/hard + registry

**Files:**
- Create: `next/src/lib/pull-refresh.ts`
- Create: `next/src/lib/pull-refresh.test.ts`
- Test: `next/src/lib/pull-refresh.test.ts`

**Interfaces:**
- Consumes: `MandalaPage` from `@/components/MandalaApp`
- Produces:
  - `PULL_REFRESH_THRESHOLD_PX = 70`
  - `isSoftPullRefreshPage(page: MandalaPage): boolean`
  - `isPullToRefreshUiEnabled(): boolean`
  - `registerPullRefreshHandler(page: MandalaPage, handler: () => Promise<void>): () => void`
  - `runPullRefresh(page: MandalaPage): Promise<'soft-ok' | 'soft-error' | 'hard'>`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isSoftPullRefreshPage,
  registerPullRefreshHandler,
  runPullRefresh,
} from './pull-refresh'

describe('isSoftPullRefreshPage', () => {
  it('marks home/events/messages soft and admin/account hard', () => {
    assert.equal(isSoftPullRefreshPage('home'), true)
    assert.equal(isSoftPullRefreshPage('events'), true)
    assert.equal(isSoftPullRefreshPage('messages'), true)
    assert.equal(isSoftPullRefreshPage('members'), true)
    assert.equal(isSoftPullRefreshPage('notifications'), true)
    assert.equal(isSoftPullRefreshPage('places-map'), true)
    assert.equal(isSoftPullRefreshPage('admin'), false)
    assert.equal(isSoftPullRefreshPage('account'), false)
    assert.equal(isSoftPullRefreshPage('managed-places'), false)
  })
})

describe('runPullRefresh', () => {
  it('runs registered soft handlers', async () => {
    let called = 0
    const unsub = registerPullRefreshHandler('home', async () => {
      called += 1
    })
    const result = await runPullRefresh('home')
    assert.equal(result, 'soft-ok')
    assert.equal(called, 1)
    unsub()
  })

  it('returns soft-error when a handler throws', async () => {
    const unsub = registerPullRefreshHandler('events', async () => {
      throw new Error('boom')
    })
    const result = await runPullRefresh('events')
    assert.equal(result, 'soft-error')
    unsub()
  })

  it('returns hard when page is hard or soft has no handler', async () => {
    assert.equal(await runPullRefresh('admin'), 'hard')
    assert.equal(await runPullRefresh('courses'), 'hard')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `next/`):

```bash
npx tsx --test src/lib/pull-refresh.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

Create `next/src/lib/pull-refresh.ts`:

```ts
import type { MandalaPage } from '@/components/MandalaApp'

export const PULL_REFRESH_THRESHOLD_PX = 70

const SOFT_PAGES = new Set<MandalaPage>([
  'home',
  'events',
  'calendar',
  'place-announcements',
  'members',
  'place-members',
  'messages',
  'notifications',
  'resources',
  'skills',
  'directory',
  'places-map',
])

type PullRefreshHandler = () => Promise<void>

const handlersByPage = new Map<MandalaPage, Set<PullRefreshHandler>>()

export function isSoftPullRefreshPage(page: MandalaPage): boolean {
  return SOFT_PAGES.has(page)
}

/** Desktop trackpad/souris : désactivé. Mobile / coarse : activé. */
export function isPullToRefreshUiEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return !window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches
}

export function registerPullRefreshHandler(
  page: MandalaPage,
  handler: PullRefreshHandler,
): () => void {
  let set = handlersByPage.get(page)
  if (!set) {
    set = new Set()
    handlersByPage.set(page, set)
  }
  set.add(handler)
  return () => {
    set!.delete(handler)
    if (set!.size === 0) handlersByPage.delete(page)
  }
}

/**
 * Soft : exécute tous les handlers enregistrés (Promise.all).
 * Soft sans handler → 'hard' (fallback spec).
 * Hard page → 'hard' (appelant fait location.reload).
 */
export async function runPullRefresh(page: MandalaPage): Promise<'soft-ok' | 'soft-error' | 'hard'> {
  if (!isSoftPullRefreshPage(page)) return 'hard'
  const set = handlersByPage.get(page)
  if (!set || set.size === 0) return 'hard'
  try {
    await Promise.all([...set].map((h) => h()))
    return 'soft-ok'
  } catch {
    return 'soft-error'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx --test src/lib/pull-refresh.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add next/src/lib/pull-refresh.ts next/src/lib/pull-refresh.test.ts
git commit -m "feat(pull-refresh): mapping soft/hard et registre de handlers"
```

---

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

### Task 3: Brancher Layout

**Files:**
- Modify: `next/src/components/layout/Layout.tsx`

**Interfaces:**
- Consumes: `PullToRefresh`, `page: MandalaPage`
- Produces: scroll principal wrappé (sauf `page === 'messages'`)

- [ ] **Step 1: Wrap `<main>` content**

Replace the non-messages `<main>` so the scroll lives on `PullToRefresh`:

Before: `main` has `overflow-auto` and `{children}`.

After:

```tsx
<main
  className={`flex-1 min-h-0 min-w-0 w-full flex flex-col ${
    page === 'home' ? 'p-0' : 'p-0'
  }`}
>
  <PullToRefresh
    page={page}
    className={`flex-1 overflow-auto ${page === 'home' ? 'p-0' : 'p-4 md:p-6'}`}
  >
    {children}
  </PullToRefresh>
</main>
```

Keep Messages branch unchanged (no `PullToRefresh` here).

Import: `import { PullToRefresh } from '@/components/PullToRefresh'`

- [ ] **Step 2: Smoke mental check**

- Pages hard sans handler → pull déclenche `runPullRefresh` → `'hard'` → reload
- Pages soft sans handler encore → aussi hard jusqu’à Task 4–6 (fallback spec OK temporairement)

- [ ] **Step 3: Commit**

```bash
git add next/src/components/layout/Layout.tsx
git commit -m "feat(pull-refresh): brancher PullToRefresh sur le Layout"
```

---

### Task 4: Soft handlers — Query + Accueil / Events / Calendar / communautés

**Files:**
- Modify: `next/src/views/HomePage.tsx`
- Modify: `next/src/views/EventsPage.tsx`
- Modify: `next/src/views/CalendarPage.tsx`
- Create or modify small helper if needed inside each file

**Interfaces:**
- Consumes: `useRegisterPullRefresh`, `useQueryClient`, `queryKeys`, `useCommunity().refresh`

- [ ] **Step 1: HomePage**

Register handler (stable `useCallback`):

```ts
const queryClient = useQueryClient()
const { active, refresh: refreshCommunities } = useCommunity()
const onPull = useCallback(async () => {
  await refreshCommunities({ background: true })
  if (active?.slug) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.placeEvents(active.slug) })
  }
  window.dispatchEvent(new CustomEvent('mandala-pull-refresh', { detail: { page: 'home' } }))
}, [active?.slug, queryClient, refreshCommunities])
useRegisterPullRefresh('home', onPull)
```

- [ ] **Step 2: EventsPage + CalendarPage**

Same pattern: `invalidateQueries(placeEvents)` + `refreshCommunities({ background: true })` ; register for `'events'` / `'calendar'`.

Calendar may also re-fetch day data if it has a local `load` — call it inside the handler if present.

- [ ] **Step 3: Commit**

```bash
git add next/src/views/HomePage.tsx next/src/views/EventsPage.tsx next/src/views/CalendarPage.tsx
git commit -m "feat(pull-refresh): soft refetch Accueil Events Calendar"
```

---

### Task 5: Soft handlers — Agora, Annonces, Membres, Alertes, listes

**Files:**
- Modify: `next/src/components/community/AgoraFeed.tsx`
- Modify: `next/src/components/place/PlaceAnnouncementsSection.tsx`
- Modify: `next/src/views/PlaceAnnouncementsPage.tsx`
- Modify: `next/src/views/MembersPage.tsx`
- Modify: `next/src/views/NotificationsPage.tsx`
- Modify: `next/src/views/PlacesMapPage.tsx`
- And resources / skills / directory views that hold the fetch (`ResourcesPage`, skills directory page, `DirectoryPage`) — locate exact files and register.

**Interfaces:**
- Consumes: `useRegisterPullRefresh` and/or `window` event `mandala-pull-refresh`

**Pattern A (page owns fetch):** `useRegisterPullRefresh('members', loadCommunity)` (and directory mode → `loadDirectory`).

**Pattern B (section on Home):** listen to `mandala-pull-refresh` when `detail.page === 'home'` and call existing `load()` without emptying UI first (keep current items while fetching). Prefer not setting `loading=true` on pull if that blanks the list — use a local `refreshing` flag or call API then `setPosts` only.

For Agora / Annonces on Home:

```ts
useEffect(() => {
  const onPull = (ev: Event) => {
    const page = (ev as CustomEvent<{ page?: string }>).detail?.page
    if (page !== 'home') return
    void load()
  }
  window.addEventListener('mandala-pull-refresh', onPull)
  return () => window.removeEventListener('mandala-pull-refresh', onPull)
}, [load])
```

Adjust `load()` so pull does not clear the list (`setLoading(true)` only when empty / first load). Same for announcements.

- [ ] **Step 1: Wire Agora + Annonces (home event + place-announcements page register)**
- [ ] **Step 2: Wire Members (`members` + `place-members` via organisationMode / same component — register both pages if the component is reused, or pass page id)**
- [ ] **Step 3: Wire Notifications (`fetchList`), PlacesMap (`loadPlaces`), Resources / Skills / Directory**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(pull-refresh): soft handlers mur membres alertes listes"
```

---

### Task 6: Messages (liste + fil)

**Files:**
- Modify: `next/src/views/MessagesPage.tsx`
- Modify: `next/src/components/social/DialogueStream.tsx`

**Interfaces:**
- Consumes: `PullToRefresh`, `useRegisterPullRefresh`, `loadChannels`, `loadChannelMessages`

- [ ] **Step 1: Wrap Messages scroll areas**

Messages Layout has no shared `<main>` scroll. Wrap:

1. Liste : the `div` with `overflow-y-auto` around channels (~line 497) → replace with `<PullToRefresh page="messages" className="flex-1 min-h-0 overflow-y-auto">…</PullToRefresh>`
2. Fil : wrap the messages scroll inside `DialogueStream` (the overflow-y container of the thread) with `<PullToRefresh page="messages" …>` **or** register handler only and rely on one outer wrapper when chat is open.

Prefer **one** `PullToRefresh` visible at a time:

- When `!chatOpen` (mobile list): wrap list scroll
- When chat open: wrap DialogueStream message list scroll

- [ ] **Step 2: Register soft handler in MessagesPage**

```ts
const onPull = useCallback(async () => {
  await loadChannels()
  const id = selectedIdRef.current
  if (id != null) {
    await useSocialStore.getState().loadChannelMessages(id)
  }
}, [loadChannels])
useRegisterPullRefresh('messages', onPull)
```

(Use the store’s `getState()` to avoid hook rules issues, or pass `loadChannelMessages` from a component that already uses the store.)

- [ ] **Step 3: DialogueStream — avoid blanking on pull**

Ensure `loadChannelMessages` does not clear messages before replace (store already merges/replaces — verify). If DialogueStream sets empty on load start, skip that on refresh.

- [ ] **Step 4: Commit**

```bash
git add next/src/views/MessagesPage.tsx next/src/components/social/DialogueStream.tsx
git commit -m "feat(pull-refresh): Messages liste et fil"
```

---

### Task 7: Vérification

**Files:** none new

- [ ] **Step 1: Unit tests**

```bash
cd next && npx tsx --test src/lib/pull-refresh.test.ts
```

Expected: PASS

- [ ] **Step 2: Typecheck**

```bash
cd next && npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Manual checklist (DevTools device / téléphone)**

1. Accueil : pull → données à jour, pas de flash
2. Events / Membres / Annonces : idem
3. Messages liste + fil : refresh canaux / messages ; scroll OK
4. Admin / Compte : reload
5. Desktop large + souris : pas de geste
6. Scroll milieu de liste : pas de trigger

- [ ] **Step 4: Final commit if polish needed**

```bash
git commit -m "fix(pull-refresh): polish indicateur / loading soft"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Geste pull down @ scrollTop 0, seuil 70 | Task 2 |
| Soft/hard hybride C | Task 1 + 3–6 |
| Messages inclus | Task 6 |
| Desktop off | Task 1 `isPullToRefreshUiEnabled` |
| Soft error message, no forced reload | Task 2 `PullToRefresh` |
| Fallback hard sans handler | Task 1 `runPullRefresh` |
| Pas de lib / pas overscroll global | Global constraints |
| Indicateur accent | Task 2 |
