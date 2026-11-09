# Review package Task 1
Base: e27b9fafd0fe42b21446db51d2afc00802d50368
Head: dc9e97418a4af1b4a3240664771f20c2b95c633b

## Commits
dc9e974 feat(pull-refresh): mapping soft/hard et registre de handlers


## Stat
 next/src/lib/pull-refresh.test.ts | 48 +++++++++++++++++++++++++++++
 next/src/lib/pull-refresh.ts      | 65 +++++++++++++++++++++++++++++++++++++++
 2 files changed, 113 insertions(+)


## Diff
diff --git a/next/src/lib/pull-refresh.test.ts b/next/src/lib/pull-refresh.test.ts
new file mode 100644
index 0000000..6aa4e0b
--- /dev/null
+++ b/next/src/lib/pull-refresh.test.ts
@@ -0,0 +1,48 @@
+import assert from 'node:assert/strict'
+import { describe, it } from 'node:test'
+import {
+  isSoftPullRefreshPage,
+  registerPullRefreshHandler,
+  runPullRefresh,
+} from './pull-refresh'
+
+describe('isSoftPullRefreshPage', () => {
+  it('marks home/events/messages soft and admin/account hard', () => {
+    assert.equal(isSoftPullRefreshPage('home'), true)
+    assert.equal(isSoftPullRefreshPage('events'), true)
+    assert.equal(isSoftPullRefreshPage('messages'), true)
+    assert.equal(isSoftPullRefreshPage('members'), true)
+    assert.equal(isSoftPullRefreshPage('notifications'), true)
+    assert.equal(isSoftPullRefreshPage('places-map'), true)
+    assert.equal(isSoftPullRefreshPage('admin'), false)
+    assert.equal(isSoftPullRefreshPage('account'), false)
+    assert.equal(isSoftPullRefreshPage('managed-places'), false)
+  })
+})
+
+describe('runPullRefresh', () => {
+  it('runs registered soft handlers', async () => {
+    let called = 0
+    const unsub = registerPullRefreshHandler('home', async () => {
+      called += 1
+    })
+    const result = await runPullRefresh('home')
+    assert.equal(result, 'soft-ok')
+    assert.equal(called, 1)
+    unsub()
+  })
+
+  it('returns soft-error when a handler throws', async () => {
+    const unsub = registerPullRefreshHandler('events', async () => {
+      throw new Error('boom')
+    })
+    const result = await runPullRefresh('events')
+    assert.equal(result, 'soft-error')
+    unsub()
+  })
+
+  it('returns hard when page is hard or soft has no handler', async () => {
+    assert.equal(await runPullRefresh('admin'), 'hard')
+    assert.equal(await runPullRefresh('courses'), 'hard')
+  })
+})
diff --git a/next/src/lib/pull-refresh.ts b/next/src/lib/pull-refresh.ts
new file mode 100644
index 0000000..d97918d
--- /dev/null
+++ b/next/src/lib/pull-refresh.ts
@@ -0,0 +1,65 @@
+import type { MandalaPage } from '@/components/MandalaApp'
+
+export const PULL_REFRESH_THRESHOLD_PX = 70
+
+const SOFT_PAGES = new Set<MandalaPage>([
+  'home',
+  'events',
+  'calendar',
+  'place-announcements',
+  'members',
+  'place-members',
+  'messages',
+  'notifications',
+  'resources',
+  'skills',
+  'directory',
+  'places-map',
+])
+
+type PullRefreshHandler = () => Promise<void>
+
+const handlersByPage = new Map<MandalaPage, Set<PullRefreshHandler>>()
+
+export function isSoftPullRefreshPage(page: MandalaPage): boolean {
+  return SOFT_PAGES.has(page)
+}
+
+/** Desktop trackpad/souris : désactivé. Mobile / coarse : activé. */
+export function isPullToRefreshUiEnabled(): boolean {
+  if (typeof window === 'undefined') return false
+  return !window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches
+}
+
+export function registerPullRefreshHandler(
+  page: MandalaPage,
+  handler: PullRefreshHandler,
+): () => void {
+  let set = handlersByPage.get(page)
+  if (!set) {
+    set = new Set()
+    handlersByPage.set(page, set)
+  }
+  set.add(handler)
+  return () => {
+    set!.delete(handler)
+    if (set!.size === 0) handlersByPage.delete(page)
+  }
+}
+
+/**
+ * Soft : exécute tous les handlers enregistrés (Promise.all).
+ * Soft sans handler → 'hard' (fallback spec).
+ * Hard page → 'hard' (appelant fait location.reload).
+ */
+export async function runPullRefresh(page: MandalaPage): Promise<'soft-ok' | 'soft-error' | 'hard'> {
+  if (!isSoftPullRefreshPage(page)) return 'hard'
+  const set = handlersByPage.get(page)
+  if (!set || set.size === 0) return 'hard'
+  try {
+    await Promise.all([...set].map((h) => h()))
+    return 'soft-ok'
+  } catch {
+    return 'soft-error'
+  }
+}

