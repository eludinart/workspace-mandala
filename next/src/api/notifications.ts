import { api } from '@/lib/api-client'

const cleanParams = (params: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )

export const notificationsApi = {
  list: (params: Record<string, unknown> = {}) => {
    const q = new URLSearchParams(cleanParams(params) as Record<string, string>).toString()
    return api.get(`/api/notifications/list${q ? '?' + q : ''}`)
  },
  unreadCount: () => api.get('/api/notifications/unread_count'),
  markRead: (ids: string[]) => api.post('/api/notifications/mark_read', { ids }),
  markAllRead: () => api.post('/api/notifications/mark_all_read', {}),
  deleteRead: () => api.post('/api/notifications/delete_read', {}),
  getPreferences: () => api.get('/api/notifications/preferences'),
  savePreferences: (prefs: Record<string, unknown>) =>
    api.post('/api/notifications/preferences', prefs),
  stats: () => api.get('/api/notifications/stats'),
  ensureTables: () => api.post('/api/notifications/ensure_tables', {}),
  vapidPublicKey: () => api.get('/api/notifications/vapid_public_key'),
  registerPushSubscription: (payload: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }) => api.post('/api/notifications/register_push_subscription', payload),
  unregisterPushSubscription: (payload: { endpoint: string }) =>
    api.post('/api/notifications/unregister_push_subscription', payload),
  /** @deprecated alias → registerPushSubscription */
  registerPushToken: (payload: Record<string, unknown>) =>
    api.post('/api/notifications/register_push_subscription', payload),
  create: (notification: Record<string, unknown>) =>
    api.post('/api/notifications/create', notification),
  adminList: (params: Record<string, unknown> = {}) => {
    const q = new URLSearchParams(cleanParams(params) as Record<string, string>).toString()
    return api.get(`/api/notifications/admin_list${q ? '?' + q : ''}`)
  },
  adminDelete: (payload: { ids?: number[]; filters?: Record<string, unknown> }) =>
    api.post('/api/notifications/admin_delete', payload),
  test: () => api.post('/api/notifications/test_push', {}),
  testPush: () => api.post('/api/notifications/test_push', {}),
}
