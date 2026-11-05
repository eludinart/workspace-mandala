import { api } from '@/lib/api-client'
import type { SkillRegister, SkillScope } from '@/lib/skill-constants'

export type SkillTag = { label: string; register: SkillRegister }

export type SkillPlaceRef = {
  id: number
  slug: string
  name: string
  logo_emoji: string | null
}

export type SkillProfile = {
  user_id: number
  scope: SkillScope
  offer_text: string
  seek_text: string
  frame_text: string
  residence_city: string
  practice_locations: string[]
  updated_at: string | null
  place_ids: number[]
  places: SkillPlaceRef[]
  tags: SkillTag[]
}

export type SkillCard = {
  user_id: number
  pseudo: string
  display_name: string
  avatar_emoji: string
  avatar: string | null
  scope: SkillScope
  offer_text: string
  seek_text: string
  frame_text: string
  tags: SkillTag[]
  places: SkillPlaceRef[]
  is_me: boolean
  shares_place?: boolean
  shared_place_slug?: string | null
  bio?: string
  resources?: Array<{ id: number; kind: string; title: string; summary: string }>
  skills_visible?: boolean
  pro_boost?: boolean
  pro_verified?: boolean
  pro_tagline?: string | null
  pro_modalities?: string | null
  pro_service_area?: string | null
  pro_external_url?: string | null
  pro_endorsement_place?: string | null
  profile_views_30d?: number
  residence_city?: string
  practice_locations?: string[]
}

export type SkillNote = {
  id: number
  author_id: number
  content: string
  scope: 'places' | 'mandala'
  created_at: string
  author_pseudo: string
  author_avatar_emoji: string
  author_avatar: string | null
  places: SkillPlaceRef[]
  is_mine: boolean
}

export type AnnuaireAudience = 'all' | 'pro' | 'members'

export type AnnuaireMapMarker = {
  id: string
  kind: 'practice' | 'mandala_place'
  latitude: number
  longitude: number
  label: string
  user_id?: number
  display_name?: string
  pro_verified?: boolean
  community_id?: number
  community_slug?: string
  community_emoji?: string | null
  place_names?: string[]
}

export const skillsApi = {
  getMine: () => api.get('/api/skills/profile') as Promise<{ profile: SkillProfile }>,
  saveMine: (body: {
    scope: SkillScope
    offer_text: string
    seek_text: string
    frame_text: string
    residence_city?: string
    practice_locations?: string[]
    place_ids: number[]
    tags: SkillTag[]
  }) => api.put('/api/skills/profile', body) as Promise<{ profile: SkillProfile }>,
  directory: (params: { view: 'place' | 'mandala'; communitySlug?: string; q?: string; tag?: string }) => {
    const q = new URLSearchParams()
    q.set('view', params.view)
    if (params.communitySlug) q.set('community_slug', params.communitySlug)
    if (params.q) q.set('q', params.q)
    if (params.tag) q.set('tag', params.tag)
    return api.get(`/api/skills/directory?${q}`) as Promise<{ cards: SkillCard[] }>
  },
  publicDirectory: (params?: { communitySlug?: string; q?: string; tag?: string }) => {
    const q = new URLSearchParams()
    if (params?.communitySlug) q.set('community_slug', params.communitySlug)
    if (params?.q) q.set('q', params.q)
    if (params?.tag) q.set('tag', params.tag)
    const qs = q.toString()
    return api.get(`/api/skills/public${qs ? `?${qs}` : ''}`) as Promise<{ cards: SkillCard[] }>
  },
  mapMarkers: (params?: { audience?: AnnuaireAudience; communitySlug?: string }) => {
    const q = new URLSearchParams()
    if (params?.audience && params.audience !== 'all') q.set('audience', params.audience)
    if (params?.communitySlug) q.set('community_slug', params.communitySlug)
    const qs = q.toString()
    return api.get(`/api/skills/map${qs ? `?${qs}` : ''}`) as Promise<{
      markers: AnnuaireMapMarker[]
    }>
  },
  card: (userId: number) =>
    api.get(`/api/skills/members/${userId}`) as Promise<{ card: SkillCard }>,
  stats: () =>
    api.get('/api/skills/stats') as Promise<{
      views_30d: number
      pro_status: string
      plan_id: string | null
      verification: string
      reject_reason: string | null
      endorsement_place_name: string | null
      tagline: string | null
    }>,
  notifyContactLead: (proUserId: number) =>
    api.post('/api/skills/contact-lead', { pro_user_id: proUserId }) as Promise<{
      ok: boolean
    }>,
  notes: (limit = 40) =>
    api.get(`/api/skills/notes?limit=${limit}`) as Promise<{ notes: SkillNote[] }>,
  createNote: (content: string) =>
    api.post('/api/skills/notes', { content }) as Promise<{ note: SkillNote }>,
  deleteNote: (id: number) => api.delete(`/api/skills/notes/${id}`) as Promise<{ ok: boolean }>,
}
