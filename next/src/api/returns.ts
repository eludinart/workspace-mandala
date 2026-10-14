import { api } from '@/lib/api-client'

export type ReturnSummary = {
  count: number
  removed_count: number
  show_average: boolean
  clarity: number | null
  frame: number | null
  quality: number | null
  recommend_yes: number
}

export type ReturnItem = {
  id: number
  target_type: 'place' | 'event' | 'accompaniment'
  occasion_label: string
  occasion_date: string
  clarity: number
  frame: number
  quality: number
  recommend: boolean
  body: string
  author_name: string
  is_mine: boolean
  can_edit: boolean
  can_reply: boolean
  status: 'published' | 'pending_pair'
  pending_note: string | null
  reply_body: string | null
  reply_name: string | null
  created_at: string
}

export type WriteSlot = {
  kind: 'place' | 'event' | 'accompaniment'
  community_slug: string
  community_name: string
  occasion_date: string
  occasion_label: string
  event_id: number
  accompaniment_id: number
  other_name: string | null
}

export type ReturnsPage = {
  summary: ReturnSummary
  items: ReturnItem[]
  event_items: ReturnItem[]
  write_slots: WriteSlot[]
  blocked_reason: string | null
  can_alert: boolean
  returns_open: boolean
}

export type AccompanimentCard = {
  id: number
  status: 'pending' | 'accepted' | 'declined'
  community_slug: string
  community_name: string
  occasion_date: string
  occasion_label: string
  other_name: string
  direction: 'incoming' | 'outgoing'
  can_write: boolean
}

export type DesignateSlot = {
  community_slug: string
  community_name: string
  occasion_date: string
  occasion_label: string
  event_id: number
}

export type ReturnDraft = {
  clarity: number
  frame: number
  quality: number
  recommend: boolean
  body: string
}

export type Inbox = {
  returns_open: boolean
  incoming: AccompanimentCard[]
  outgoing: AccompanimentCard[]
  to_write: WriteSlot[]
}

export type AdminReport = {
  id: number
  return_id: number
  reason: string
  reporter_name: string
  occasion_label: string
  body: string
  created_at: string
}

export type AdminAlert = {
  id: number
  author_name: string
  place_name: string
  about_name: string | null
  message: string
  status: string
  created_at: string
}

function scores(draft: ReturnDraft, extra: Record<string, unknown>) {
  return { ...extra, ...draft }
}

export const returnsApi = {
  place: (communitySlug: string) =>
    api.get(`/api/returns?target=place&community_slug=${encodeURIComponent(communitySlug)}`) as Promise<ReturnsPage>,
  event: (eventId: number) =>
    api.get(`/api/returns?target=event&event_id=${eventId}`) as Promise<ReturnsPage>,
  person: (userId: number) =>
    api.get(`/api/returns?target=person&user_id=${userId}`) as Promise<ReturnsPage>,
  mine: () => api.get('/api/returns?mine=1') as Promise<Inbox>,
  create: (draft: ReturnDraft, extra: Record<string, unknown>) =>
    api.post('/api/returns', scores(draft, extra)) as Promise<{ ok: boolean }>,
  update: (id: number, draft: ReturnDraft) =>
    api.patch(`/api/returns/${id}`, draft) as Promise<{ ok: boolean }>,
  reply: (id: number, body: string) =>
    api.post(`/api/returns/${id}/reply`, { body }) as Promise<{ ok: boolean }>,
  report: (id: number, reason: string) =>
    api.post(`/api/returns/${id}/report`, { reason }) as Promise<{ ok: boolean }>,
  optIn: () => api.get('/api/returns/opt-in') as Promise<{ open: boolean }>,
  setOptIn: (open: boolean) => api.put('/api/returns/opt-in', { open }) as Promise<{ open: boolean }>,
  candidates: (companionUserId: number) =>
    api.get(`/api/returns/candidates?companion_user_id=${companionUserId}`) as Promise<{ slots: DesignateSlot[] }>,
  designate: (body: {
    community_slug: string
    companion_user_id: number
    occasion_date: string
    event_id: number
  }) => api.post('/api/returns/accompaniments', body) as Promise<{ ok: boolean }>,
  respond: (id: number, action: 'accept' | 'decline') =>
    api.post(`/api/returns/accompaniments/${id}`, { action }) as Promise<{ ok: boolean }>,
  alert: (body: { community_slug: string; about_user_id?: number; message: string }) =>
    api.post('/api/returns/alerts', body) as Promise<{ ok: boolean }>,
  adminList: () => api.get('/api/returns/admin') as Promise<{ reports: AdminReport[]; alerts: AdminAlert[] }>,
  adminAct: (body: Record<string, unknown>) =>
    api.post('/api/returns/admin', body) as Promise<{ ok: boolean }>,
}
