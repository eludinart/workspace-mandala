import { api } from '@/lib/api-client'

export type ManagedPlaceOption = { id: number; slug: string; name: string }

export const placeLinksApi = {
  statusToward: (toCommunityId: number) =>
    api.get(`/api/place-links?to_community_id=${toCommunityId}`) as Promise<{
      can_link: boolean
      status: 'none' | 'pending' | 'accepted' | 'rejected' | 'canceled'
      from_community_id: number | null
      link_id: number | null
      managed: ManagedPlaceOption[]
    }>,

  request: (fromCommunityId: number, toCommunityId: number) =>
    api.post('/api/place-links', {
      from_community_id: fromCommunityId,
      to_community_id: toCommunityId,
    }) as Promise<{ ok: boolean; link: unknown }>,

  respond: (linkId: number, accept: boolean) =>
    api.post(`/api/place-links/${linkId}/respond`, { accept }) as Promise<{
      ok: boolean
      link: unknown
    }>,
}
