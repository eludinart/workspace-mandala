import { api } from '@/lib/api-client'

export type TelemetryEventItem = {
  id?: number
  ts: string
  name: string
  user_id?: number | null
  path?: string | null
  feature?: string | null
  properties?: Record<string, unknown>
}

export const telemetryApi = {
  list: (params: { from?: string; to?: string; event?: string; limit?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.from) q.set('from', params.from)
    if (params.to) q.set('to', params.to)
    if (params.event) q.set('event', params.event)
    if (params.limit) q.set('limit', String(params.limit))
    const s = q.toString()
    return api.get(`/api/telemetry/events${s ? `?${s}` : ''}`) as Promise<{ items: TelemetryEventItem[] }>
  },
  clear: () => api.delete('/api/telemetry/events'),
}
