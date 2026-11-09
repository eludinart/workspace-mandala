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

