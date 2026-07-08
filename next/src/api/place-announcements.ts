import { api } from '@/lib/api-client'

export type PlaceAnnouncement = {
  id: number
  community_id: number
  author_id: number
  title: string
  body: string
  image_data: string | null
  created_at: string
  updated_at: string | null
  author_pseudo: string
  author_avatar_emoji: string
  author_avatar: string | null
  wall_public: boolean
}

export const placeAnnouncementsApi = {
  list: (communitySlug: string, limit = 20) =>
    api.get(
      `/api/place-announcements?community_slug=${encodeURIComponent(communitySlug)}&limit=${limit}`
    ) as Promise<{
      announcements: PlaceAnnouncement[]
      can_manage?: boolean
    }>,
  create: (body: {
    community_slug: string
    title: string
    body: string
    image_data?: string | null
    wall_public?: boolean
  }) => api.post('/api/place-announcements', body) as Promise<{ announcement: PlaceAnnouncement }>,
  update: (
    id: number,
    body: { title?: string; body?: string; image_data?: string | null; wall_public?: boolean }
  ) =>
    api.patch(`/api/place-announcements/${id}`, body) as Promise<{ announcement: PlaceAnnouncement }>,
  remove: (id: number) => api.delete(`/api/place-announcements/${id}`) as Promise<{ ok: boolean }>,
}
