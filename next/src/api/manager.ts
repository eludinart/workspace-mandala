import { api } from '@/lib/api-client'
import type { CommunityAdmin, CommunityMemberAdmin } from '@/api/admin'

export type InviteCandidate = {
  id: number
  email: string
  name: string
  pseudo: string
  avatar_emoji: string
}

export type PlaceInviteInfo = {
  slug: string
  name: string
  invite_code: string
  join_mode: 'open' | 'invite' | 'closed'
  join_mode_changed: boolean
  path: string
  url: string
}

export const managerApi = {
  communities: {
    list: () => api.get('/api/manager/communities') as Promise<{ items: CommunityAdmin[] }>,
    get: (id: number) =>
      api.get(`/api/manager/communities/${id}`) as Promise<{
        community: CommunityAdmin
        members: CommunityMemberAdmin[]
      }>,
    update: (id: number, body: Record<string, unknown>) =>
      api.patch(`/api/manager/communities/${id}`, body) as Promise<{ community: CommunityAdmin }>,
    setMemberRole: (communityId: number, userId: number, role: string) =>
      api.patch(`/api/manager/communities/${communityId}/members`, { user_id: userId, role }),
    addMember: (communityId: number, userId: number) =>
      api.post(`/api/manager/communities/${communityId}/members`, { user_id: userId }) as Promise<{
        ok: boolean
        already_member: boolean
      }>,
    removeFromCommunity: (userId: number, communitySlug: string) =>
      api.post('/api/manager/members/remove-from-community', {
        user_id: userId,
        community_slug: communitySlug,
      }),
    invites: (communityId: number, q?: string) => {
      const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
      return api.get(`/api/manager/communities/${communityId}/invites${qs}`) as Promise<{
        candidates: InviteCandidate[]
        invite: PlaceInviteInfo
        email_configured: boolean
      }>
    },
    sendInviteEmail: (communityId: number, email: string, origin?: string) =>
      api.post(`/api/manager/communities/${communityId}/invites`, {
        action: 'email',
        email,
        origin,
      }) as Promise<{
        ok: boolean
        email_sent: boolean
        email_configured: boolean
        invite: PlaceInviteInfo
      }>,
    rotateInvite: (communityId: number, origin?: string) =>
      api.post(`/api/manager/communities/${communityId}/invites`, {
        action: 'rotate',
        origin,
      }) as Promise<{ invite: PlaceInviteInfo }>,
  },
}
