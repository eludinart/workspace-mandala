import { api } from '@/lib/api-client'
import type { WallFeedResponse, WallFeedSort } from '@/lib/wall-feed-types'

export const wallApi = {
  feed: (params?: { sort?: WallFeedSort; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.sort) q.set('sort', params.sort)
    if (params?.limit != null) q.set('limit', String(params.limit))
    const qs = q.toString()
    return api.get(`/api/wall${qs ? `?${qs}` : ''}`) as Promise<WallFeedResponse>
  },
}
