import { api } from '@/lib/api-client'

export const accountApi = {
  getProfile: () => api.get('/api/account/profile'),
  updateProfile: (body: Record<string, unknown>) => api.post('/api/account/profile', body),
}
