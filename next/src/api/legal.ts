import { api } from '@/lib/api-client'

export const legalApi = {
  status: () =>
    api.get('/api/legal/status') as Promise<{
      cgu_version: string
      cgv_version: string
      privacy_version: string
      cgu_accepted: boolean
      docs: Record<string, { title: string; path: string; version: string }>
    }>,
  accept: () =>
    api.post('/api/legal/accept', { accept_cgu: true }) as Promise<{
      ok: boolean
      cgu_version: string
    }>,
}
