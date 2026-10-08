import { api } from '@/lib/api-client'

export type SupportKind = 'question' | 'bug'
export type SupportStatus = 'new' | 'read' | 'done'

export type SupportReportItem = {
  id: number
  user_id: number
  author_name: string
  author_email: string
  community_slug: string | null
  page: string
  kind: SupportKind
  message: string
  user_agent: string | null
  status: SupportStatus
  created_at: string | null
}

export const supportApi = {
  create: (body: {
    kind: SupportKind
    message: string
    page: string
    community_slug?: string | null
  }) => api.post('/api/support', body) as Promise<{ ok: boolean; id: number }>,

  list: () => api.get('/api/support') as Promise<{ items: SupportReportItem[] }>,

  setStatus: (id: number, status: SupportStatus) =>
    api.patch(`/api/support/${id}`, { status }) as Promise<{ ok: boolean }>,

  remove: (id: number) => api.delete(`/api/support/${id}`) as Promise<{ ok: boolean }>,
}
