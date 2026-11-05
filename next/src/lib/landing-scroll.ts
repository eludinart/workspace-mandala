/**
 * Scroll des ancres landing dans le conteneur `.m-landing > .overflow-y-auto`
 * (pas la fenêtre). Utilisé depuis le menu et après navigation cross-page.
 */

export const LANDING_SECTION_IDS = ['top', 'mur', 'projet', 'tarifs', 'lieux'] as const

export type LandingSectionId = (typeof LANDING_SECTION_IDS)[number]

const PENDING_HASH_KEY = 'mdl_landing_hash'

export function isLandingSectionId(value: string): value is LandingSectionId {
  return (LANDING_SECTION_IDS as readonly string[]).includes(value)
}

export function getLandingScroller(): HTMLElement | null {
  return document.querySelector('.m-landing > .overflow-y-auto')
}

/** Scroll vers une section landing. Retourne false si le DOM n’est pas prêt. */
export function scrollLandingToId(
  id: string,
  behavior: ScrollBehavior = 'smooth'
): boolean {
  const scroller = getLandingScroller()
  if (!scroller) return false

  if (id === 'top') {
    scroller.scrollTo({ top: 0, behavior })
    return true
  }

  const el = document.getElementById(id)
  if (!el) return false

  const scrollerRect = scroller.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const nextTop = scroller.scrollTop + (elRect.top - scrollerRect.top)
  scroller.scrollTo({ top: Math.max(0, nextTop), behavior })
  return true
}

/** Réessaie quelques frames jusqu’à ce que la section existe (après navigation). */
export function scheduleLandingScroll(
  id: string,
  behavior: ScrollBehavior = 'smooth'
): void {
  let attempts = 0
  const tick = () => {
    attempts += 1
    if (scrollLandingToId(id, behavior) || attempts > 48) return
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function stashLandingHash(id: string): void {
  try {
    sessionStorage.setItem(PENDING_HASH_KEY, id)
  } catch {
    /* private mode */
  }
}

export function consumeStashedLandingHash(): string | null {
  try {
    const value = sessionStorage.getItem(PENDING_HASH_KEY)
    if (value) sessionStorage.removeItem(PENDING_HASH_KEY)
    return value
  } catch {
    return null
  }
}

export function readWindowLandingHash(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.location.hash.replace(/^#/, '').trim()
  return raw || null
}
