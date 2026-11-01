import { api } from '@/lib/api-client'
import type {
  ContentReasonCode,
  ContentReportItem,
  ContentReportStatus,
  ContentTargetType,
} from '@/lib/db-moderation'

export type { ContentReasonCode, ContentReportItem, ContentTargetType, ContentReportStatus }

export const moderationApi = {
  report: (body: {
    target_type: ContentTargetType
    target_id: string | number
    target_user_id?: number
    community_id?: number
    reason_code: ContentReasonCode
    details?: string
  }) => api.post('/api/moderation/reports', body) as Promise<{ ok: boolean; id: number }>,

  listReports: () =>
    api.get('/api/moderation/reports') as Promise<{ items: ContentReportItem[] }>,

  updateReport: (id: number, status: ContentReportStatus) =>
    api.patch(`/api/moderation/reports/${id}`, { status }) as Promise<{ ok: boolean }>,

  listBlocks: () =>
    api.get('/api/moderation/blocks') as Promise<{ blocked_ids: number[] }>,

  block: (userId: number) =>
    api.post('/api/moderation/blocks', { user_id: userId }) as Promise<{ ok: boolean }>,

  unblock: (userId: number) =>
    api.delete(`/api/moderation/blocks?user_id=${userId}`) as Promise<{ ok: boolean }>,
}
