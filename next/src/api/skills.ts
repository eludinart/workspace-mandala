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
  bio?: string
  resources?: Array<{ id: number; kind: string; title: string; summary: string }>
  skills_visible?: boolean
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

export const skillsApi = {
  getMine: () => api.get('/api/skills/profile') as Promise<{ profile: SkillProfile }>,
  saveMine: (body: {
    scope: SkillScope
    offer_text: string
    seek_text: string
    frame_text: string
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
  card: (userId: number) =>
    api.get(`/api/skills/members/${userId}`) as Promise<{ card: SkillCard }>,
  notes: (limit = 40) =>
    api.get(`/api/skills/notes?limit=${limit}`) as Promise<{ notes: SkillNote[] }>,
  createNote: (content: string) =>
    api.post('/api/skills/notes', { content }) as Promise<{ note: SkillNote }>,
  deleteNote: (id: number) => api.delete(`/api/skills/notes/${id}`) as Promise<{ ok: boolean }>,
}
