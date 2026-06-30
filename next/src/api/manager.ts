import { api } from '@/lib/api-client'
import type { CommunityAdmin, CommunityMemberAdmin } from '@/api/admin'

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
    removeFromCommunity: (userId: number, communitySlug: string) =>
      api.post('/api/manager/members/remove-from-community', {
        user_id: userId,
        community_slug: communitySlug,
      }),
  },
}
