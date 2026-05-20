import { api } from '@/lib/api-client'

export const eventsApi = {
  list: (communitySlug: string) =>
    api.get(`/api/events?community_slug=${encodeURIComponent(communitySlug)}`),
  get: (eventId: number) => api.get(`/api/events/${eventId}`),
  create: (body: Record<string, unknown>) => api.post('/api/events', body),
  update: (eventId: number, body: Record<string, unknown>) =>
    api.patch(`/api/events/${eventId}`, body),
  addStaff: (eventId: number, body: { user_id: number; role: string; note?: string }) =>
    api.post(`/api/events/${eventId}/staff`, body),
  removeStaff: (eventId: number, userId: number) =>
    api.delete(`/api/events/${eventId}/staff?user_id=${userId}`),
  addTask: (eventId: number, body: { title: string; phase?: string }) =>
    api.post(`/api/events/${eventId}/tasks`, body),
  toggleTask: (eventId: number, taskId: number, is_done: boolean) =>
    api.patch(`/api/events/${eventId}/tasks/${taskId}`, { is_done }),
  communityMembers: (communitySlug: string) =>
    api.get(`/api/events/members?community_slug=${encodeURIComponent(communitySlug)}`),
  addMedia: (eventId: number, body: { image_data: string; caption?: string }) =>
    api.post(`/api/events/${eventId}/media`, body),
  removeMedia: (eventId: number, mediaId: number) =>
    api.delete(`/api/events/${eventId}/media?media_id=${mediaId}`),
}
