import { api } from '@/lib/api-client'

export type PublicNetworkStats = {
  ok?: boolean
  places: number
  people: number
}

export const publicApi = {
  stats: () => api.get('/api/public/stats') as Promise<PublicNetworkStats>,
}
