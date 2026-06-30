import { api } from '@/lib/api-client'

export type MemberDirectoryCommunity = {
  id: number
  slug: string
  name: string
  logo_emoji: string | null
  member_count: number
}

export type MemberDirectoryEntry = {
  user_id: number
  pseudo: string
  display_name: string
  avatar_emoji: string
  avatar: string | null
  profile_public: boolean
  is_me: boolean
  communities: Array<{
    slug: string
    name: string
    logo_emoji: string | null
    role: string
    weather_status?: string | null
    weather_note?: string | null
  }>
}

export type CommunityMember = {
  user_id: number
  pseudo: string
  display_name: string
  avatar_emoji: string
  avatar: string | null
  profile_public: boolean
  is_me: boolean
  role?: string
  weather_status?: string | null
  weather_note?: string | null
}

export const membersApi = {
  listCommunity: (communitySlug: string) =>
    api.get(`/api/members/community?community_slug=${encodeURIComponent(communitySlug)}`),
  directory: () =>
    api.get('/api/members/directory') as Promise<{
      communities?: MemberDirectoryCommunity[]
      members?: MemberDirectoryEntry[]
    }>,
}
