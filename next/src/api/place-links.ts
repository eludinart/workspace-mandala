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
      /** True si la cible est aussi un lieu géré par l’utilisateur. */
      target_is_managed?: boolean
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

  /** Lieux amis (accepted) d’un lieu — pour traits carte / fiche. Porte lieux_lies. */
  friendsOf: (communityId: number) =>
    api.get(`/api/place-links/friends?community_id=${communityId}`) as Promise<{
      friend_ids: number[]
      friends: Array<{ id: number; slug: string; name: string }>
      can_view: boolean
    }>,
}
