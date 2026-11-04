import { api } from '@/lib/api-client'

export type PublicCommunityCard = {
  id: number
  slug: string
  name: string
  tagline?: string | null
  description?: string | null
  location?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
  website?: string | null
  contact_email?: string | null
  latitude?: number | null
  longitude?: number | null
  accent_color?: string | null
  logo_emoji?: string | null
  avatar?: string | null
  listed_public?: boolean
  profile_public?: boolean
  join_mode?: 'open' | 'invite' | 'closed'
  /** Présent sur le catalogue / carte (hover). */
  member_count?: number
}

export type PublicCommunityProfile = PublicCommunityCard & {
  member_count: number
  /** HTML sanitizé de la charte. */
  charter: string
}

export type MemberCharterView = {
  slug: string
  name: string
  tagline: string | null
  logo_emoji: string | null
  accent_color: string | null
  avatar: string | null
  /** HTML sanitizé de la charte. */
  charter: string
  accepted: boolean
  accepted_at: string | null
  requires_acceptance: boolean
}

export type CommunityManagerSettings = {
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
  /** HTML sanitizé de la charte. */
  charter: string
  listed_public: boolean
  profile_public: boolean
  join_mode?: 'open' | 'invite' | 'closed'
  invite_code?: string | null
  can_manage?: boolean
  member_role?: string | null
}

export type GeocodeResult = {
  latitude: number
  longitude: number
  display_name: string
}

export const communitiesApi = {
  mine: () => api.get('/api/communities/mine') as Promise<{ items?: unknown[] }>,
  catalog: () => api.get('/api/communities/catalog') as Promise<{ items?: unknown[] }>,
  publicList: () =>
    api.get('/api/communities/public') as Promise<{ items?: PublicCommunityCard[] }>,
  onboardingStatus: () =>
    api.get('/api/onboarding/status') as Promise<{
      needs_place_selection?: boolean
      pending_charter_slugs?: string[]
    }>,
  continueWithoutPlace: () =>
    api.post('/api/onboarding/continue-without-place', {}) as Promise<{ ok: boolean }>,
  getCharter: (slug: string) =>
    api.get(`/api/communities/${encodeURIComponent(slug)}/charter`) as Promise<{
      charter: MemberCharterView
    }>,
  acceptCharter: (slug: string) =>
    api.post(`/api/communities/${encodeURIComponent(slug)}/charter`, {}) as Promise<{
      accepted_at: string
      slug: string
    }>,
  join: (slug: string, inviteCode?: string | null) =>
    api.post('/api/communities/join', {
      slug,
      ...(inviteCode ? { invite_code: inviteCode } : {}),
    }),
  leave: (slug: string) => api.post('/api/communities/leave', { community_slug: slug }),
  create: (body: {
    slug: string
    name: string
    tagline?: string
    accent_color?: string
    logo_emoji?: string
  }) => api.post('/api/communities/create', body),
  getSettings: (slug: string) =>
    api.get(`/api/communities/${encodeURIComponent(slug)}/settings`) as Promise<{
      settings: CommunityManagerSettings
    }>,
  updateSettings: (slug: string, body: Record<string, unknown>) =>
    api.patch(`/api/communities/${encodeURIComponent(slug)}/settings`, body) as Promise<{
      settings: CommunityManagerSettings
    }>,
  geocode: (
    slug: string,
    body: { address?: string | null; postal_code?: string | null; city?: string | null; country?: string | null }
  ) =>
    api.post(`/api/communities/${encodeURIComponent(slug)}/geocode`, body) as Promise<{
      result: GeocodeResult
    }>,
}
