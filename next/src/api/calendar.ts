import { api } from '@/lib/api-client'

export const calendarApi = {
  month: (communitySlug: string, ym: string) =>
    api.get(
      `/api/calendar/month?community_slug=${encodeURIComponent(communitySlug)}&ym=${encodeURIComponent(ym)}`
    ),
  day: (communitySlug: string, day: string) =>
    api.get(
      `/api/calendar/day?community_slug=${encodeURIComponent(communitySlug)}&day=${encodeURIComponent(day)}`
    ),
  setPresence: (body: { community_slug: string; day: string; present: boolean; user_id?: number }) =>
    api.post('/api/calendar/presence', body),
  setDayDisabled: (body: { community_slug: string; day: string; is_disabled: boolean; reason?: string }) =>
    api.post('/api/calendar/day-settings', body),
  settings: (communitySlug: string) =>
    api.get(`/api/calendar/settings?community_slug=${encodeURIComponent(communitySlug)}`),
  updateSettings: (body: { community_slug: string; show_presence?: boolean; show_events?: boolean }) =>
    api.patch('/api/calendar/settings', body),
}

