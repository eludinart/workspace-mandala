import { api } from '@/lib/api-client'

export type PlaceListKind = 'courses' | 'logistics'

export const placeListsApi = {
  list: (communitySlug: string, kind: PlaceListKind, view: 'active' | 'history' = 'active') =>
    api.get(
      `/api/place-lists?community_slug=${encodeURIComponent(communitySlug)}&kind=${encodeURIComponent(kind)}&view=${view}`
    ),
  create: (body: {
    community_slug: string
    kind: PlaceListKind
    title: string
    notes?: string
    images?: string[]
  }) => api.post('/api/place-lists', body),
  action: (
    id: number,
    body: {
      community_slug: string
      action:
        | 'claim'
        | 'unclaim'
        | 'set_date'
        | 'brought'
        | 'defer'
        | 'update_details'
        | 'add_photos'
        | 'remove_photo'
      bring_date?: string
      title?: string
      notes?: string | null
      images?: string[]
      photo_id?: number
    }
  ) => api.patch(`/api/place-lists/${id}`, body),
  remove: (id: number, communitySlug: string) =>
    api.delete(
      `/api/place-lists/${id}?community_slug=${encodeURIComponent(communitySlug)}`
    ),
  summary: (communitySlug: string) =>
    api.get(`/api/place-ops/summary?community_slug=${encodeURIComponent(communitySlug)}`),
}

export const circleJournalApi = {
  month: (communitySlug: string, ym: string) =>
    api.get(
      `/api/circle-journal?community_slug=${encodeURIComponent(communitySlug)}&ym=${encodeURIComponent(ym)}`
    ),
  session: (communitySlug: string, day: string, slot: 'morning' | 'evening') =>
    api.get(
      `/api/circle-journal/session?community_slug=${encodeURIComponent(communitySlug)}&day=${encodeURIComponent(day)}&slot=${encodeURIComponent(slot)}`
    ),
  upsert: (body: {
    community_slug: string
    day: string
    slot: 'morning' | 'evening'
    title?: string
    summary?: string
    image_data?: string
  }) => api.post('/api/circle-journal', body),
  remove: (communitySlug: string, day: string, slot: 'morning' | 'evening') =>
    api.delete(
      `/api/circle-journal/session?community_slug=${encodeURIComponent(communitySlug)}&day=${encodeURIComponent(day)}&slot=${encodeURIComponent(slot)}`
    ),
}
