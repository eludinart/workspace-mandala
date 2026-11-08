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
