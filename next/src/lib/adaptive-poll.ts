/**
 * Polling HTTP : pause onglet caché ; tick immédiat au retour (via useVisibilityPoll).
 * Seules les notifications sont assouplies (45 s) pour limiter la charge fond.
 * Chat / canaux / présence gardent la réactivité d’origine.
 */

export type PollKind = 'notifications' | 'chat_thread' | 'channels' | 'presence'

export type VisibilityState = 'visible' | 'hidden'

export const POLL_INTERVALS_MS: Record<
  PollKind,
  { visible: number; hidden: null }
> = {
  notifications: { visible: 45_000, hidden: null },
  chat_thread: { visible: 15_000, hidden: null },
  channels: { visible: 60_000, hidden: null },
  presence: { visible: 120_000, hidden: null },
}

export function resolvePollIntervalMs(
  kind: PollKind,
  visibility: VisibilityState,
): number | null {
  const cfg = POLL_INTERVALS_MS[kind]
  return visibility === 'hidden' ? cfg.hidden : cfg.visible
}

export function readDocumentVisibility(): VisibilityState {
  if (typeof document === 'undefined') return 'visible'
  return document.visibilityState === 'hidden' ? 'hidden' : 'visible'
}
