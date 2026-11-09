import { api } from '@/lib/api-client'

export type CommunityAdmin = {
  id: number
  slug: string
  name: string
  tagline: string | null
  description: string | null
  location: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  website: string | null
  contact_email: string | null
  latitude: number | null
  longitude: number | null
  accent_color: string | null
  logo_emoji: string | null
  avatar: string | null
  has_avatar?: boolean
  is_active: boolean
  listed_public: boolean
  profile_public: boolean
  member_count: number
  created_at: string | null
}

export type CommunityMemberAdmin = {
  user_id: number
  email: string
  pseudo: string
  display_name: string
  role: string
  circle?: 'member' | 'core'
  joined_at: string | null
}

export type AdminManagedUser = {
  id: number
  email: string
  login: string
  name: string
  pseudo?: string | null
  first_name?: string | null
  last_name?: string | null
  show_full_last_name?: boolean
  app_role?: string
  profile_public?: boolean
  bio?: string | null
  registered?: string
  communities?: Array<{
    id: number
    slug: string
    name: string
    role: string
    logo_emoji?: string | null
    is_sole_manager?: boolean
  }>
}

export const adminApi = {
  users: {
    get: (userId: number, communitySlug?: string) => {
      const qs = communitySlug ? `?community_slug=${encodeURIComponent(communitySlug)}` : ''
      return api.get(`/api/admin/users/${userId}${qs}`) as Promise<AdminManagedUser>
    },
    update: (userId: number, body: Record<string, unknown>) =>
      api.patch(`/api/admin/users/${userId}`, body) as Promise<AdminManagedUser>,
    resetPassword: (
      userId: number,
      body: { password?: string; send_email?: boolean; community_slug?: string }
    ) =>
      api.post(`/api/admin/users/${userId}/reset-password`, body) as Promise<{
        ok: boolean
        temporary_password: string
        email_sent: boolean
        email_configured: boolean
      }>,
    removeFromCommunity: (userId: number, communitySlug: string) =>
      api.post(`/api/admin/users/${userId}/remove-from-community`, {
        community_slug: communitySlug,
      }) as Promise<{ ok: boolean; community_slug: string; community_name: string }>,
  },
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
    setMemberCircle: (communityId: number, userId: number, circle: 'member' | 'core') =>
      api.patch(`/api/admin/communities/${communityId}/members`, { user_id: userId, circle }),
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
  push: {
    overview: (range: '24h' | '7d' = '24h') =>
      api.get(`/api/admin/push/overview?range=${range}`) as Promise<{
        range: string
        accepted: number
        gone: number
        error: number
        delivered: number
        opened: number
        delivery_rate: number | null
        open_rate: number | null
        pending_accepted: number
        recent_failures: Array<{
          id: number
          user_id: number
          title: string
          status: string
          error_detail: string | null
          created_at: string | null
        }>
        users_never_delivered: Array<{
          user_id: number
          devices: number
          last_accepted_at: string | null
        }>
      }>,
    user: (userId: number) =>
      api.get(`/api/admin/push/user/${userId}`) as Promise<{
        user_id: number
        devices: Array<{
          id: number
          platform: string | null
          standalone: boolean | null
          user_agent: string | null
          last_seen_at: string | null
          created_at: string | null
          updated_at: string | null
        }>
        sends: Array<{
          id: number
          title: string
          status: string
          error_detail: string | null
          created_at: string | null
          delivered_at?: string | null
          opened_at?: string | null
        }>
      }>,
    testUser: (userId: number) =>
      api.post('/api/admin/push/test_user', { userId }) as Promise<{
        ok: boolean
        devices?: number
        sent?: number
        gone?: number
        errors?: number
        error?: string
      }>,
    checkAlerts: () => api.post('/api/admin/push/check_alerts', {}) as Promise<Record<string, unknown>>,
  },
}
