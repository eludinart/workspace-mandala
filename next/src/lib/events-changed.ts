/** Bus fenêtre + invalidation Query pour les listes d’événements d’un lieu. */

import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export type EventsChangedDetail = {
  communitySlug: string
  eventId?: number
}

export function emitEventsChanged(detail: EventsChangedDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('mandala-events-changed', { detail }))
}

export function invalidatePlaceEvents(queryClient: QueryClient, communitySlug: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.placeEvents(communitySlug) })
}

/** Invalide le cache Query et prévient les écrans encore sur le bus CustomEvent. */
export function notifyPlaceEventsChanged(
  queryClient: QueryClient,
  detail: EventsChangedDetail,
): void {
  invalidatePlaceEvents(queryClient, detail.communitySlug)
  emitEventsChanged(detail)
}
