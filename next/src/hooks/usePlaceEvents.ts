'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/api/events'
import { type HomeEventPreview } from '@/lib/event-preview'
import { queryKeys } from '@/lib/query-keys'
import { notifyPlaceEventsChanged } from '@/lib/events-changed'

export type PlaceEventsResult = {
  events: HomeEventPreview[]
  elsewhere: HomeEventPreview[]
  can_manage: boolean
}

async function fetchPlaceEvents(slug: string): Promise<PlaceEventsResult> {
  const res = (await eventsApi.list(slug)) as {
    events?: HomeEventPreview[]
    elsewhere?: HomeEventPreview[]
    can_manage?: boolean
  }
  return {
    events: res.events ?? [],
    elsewhere: res.elsewhere ?? [],
    can_manage: !!res.can_manage,
  }
}

/**
 * Liste événements du lieu actif + « Ailleurs ».
 * Pas de placeholderData : au switch de slug, pas d’anciennes données peintes.
 */
export function usePlaceEvents(communitySlug: string | null | undefined) {
  const slug = communitySlug?.trim() || null
  return useQuery({
    queryKey: slug ? queryKeys.placeEvents(slug) : ['place-events', 'none'],
    queryFn: () => fetchPlaceEvents(slug!),
    enabled: !!slug,
    staleTime: 30_000,
  })
}

export function useNotifyPlaceEventsChanged() {
  const queryClient = useQueryClient()
  return (detail: { communitySlug: string; eventId?: number }) => {
    notifyPlaceEventsChanged(queryClient, detail)
  }
}
