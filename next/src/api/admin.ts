import { api } from '@/lib/api-client'

export type CommunityAdmin = {
  id: number
  slug: string
  name: string
  tagline: string | null
  description: string | null
  location: string | null
  website: string | null
  contact_email: string | null
  accent_color: string | null
  logo_emoji: string | null
  avatar: string | null
  has_avatar?: boolean
  is_active: boolean
  member_count: number
  created_at: string | null
}

export type CommunityMemberAdmin = {
  user_id: number
  email: string
  pseudo: string
  display_name: string
  role: string
  joined_at: string | null
}

export const adminApi = {
  communities: {
    list: () => api.get('/api/admin/communities') as Promise<{ items: CommunityAdmin[] }>,
    get: (id: number) =>
      api.get(`/api/admin/communities/${id}`) as Promise<{
        community: CommunityAdmin
        members: CommunityMemberAdmin[]
      }>,
    update: (id: number, body: Record<string, unknown>) =>
      api.patch(`/api/admin/communities/${id}`, body) as Promise<{ community: CommunityAdmin }>,
    setMemberRole: (communityId: number, userId: number, role: string) =>
      api.patch(`/api/admin/communities/${communityId}/members`, { user_id: userId, role }),
  },
  broadcasts: {
    list: (params: { page?: number; status?: string } = {}) => {
      const p = new URLSearchParams()
      if (params.page) p.set('page', String(params.page))
      if (params.status) p.set('status', params.status)
      const qs = p.toString()
      return api.get(`/api/admin/broadcasts/list${qs ? `?${qs}` : ''}`)
    },
    create: (body: Record<string, unknown>) => api.post('/api/admin/broadcasts/create', body),
    preview: (audience: Record<string, unknown>) =>
      api.post('/api/admin/broadcasts/preview', { audience }),
    enqueue: (id: number) => api.post('/api/admin/broadcasts/enqueue', { id }),
  },
}
