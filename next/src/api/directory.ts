import { api } from '@/lib/api-client'

export type MeetStatus = {
  mode: 'shared' | 'pending' | 'incoming' | 'conversation' | 'none'
  slug?: string
  request_id?: number
  channel_id?: number
}

export const directoryApi = {
  meetStatus: (userId: number) =>
    api.get(`/api/directory/meet?user_id=${encodeURIComponent(String(userId))}`) as Promise<MeetStatus>,
  requestMeet: (targetUserId: number) =>
    api.post('/api/directory/meet', { target_user_id: targetUserId }) as Promise<MeetStatus>,
  respondMeet: (requestId: number, accept: boolean) =>
    api.post('/api/directory/meet/respond', { request_id: requestId, accept }) as Promise<MeetStatus>,
}
