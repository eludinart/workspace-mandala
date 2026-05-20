import { api } from '@/lib/api-client'

export const communitiesApi = {
  mine: () => api.get('/api/communities/mine') as Promise<{ items?: unknown[] }>,
  catalog: () => api.get('/api/communities/catalog') as Promise<{ items?: unknown[] }>,
  join: (slug: string) => api.post('/api/communities/join', { slug }),
  create: (body: {
    slug: string
    name: string
    tagline?: string
    accent_color?: string
    logo_emoji?: string
  }) => api.post('/api/communities/create', body),
}
