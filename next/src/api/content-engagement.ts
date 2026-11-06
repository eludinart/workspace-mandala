import { api } from '@/lib/api-client'
import type { ContentEngagementKind } from '@/lib/content-share'
import type { MessageReactionSummary } from '@/lib/message-reactions'
import type { ContentCommentRow } from '@/lib/db-content-engagement'

export type ContentEngagementBundle = {
  reactions: MessageReactionSummary[]
  comments: ContentCommentRow[]
  myEmoji: string | null
  wall_public: boolean
  place_slug: string | null
  can_engage: boolean
  share_path: string | null
}

export const contentEngagementApi = {
  get: (kind: ContentEngagementKind, targetId: number) =>
    api.get(
      `/api/content-engagement?kind=${encodeURIComponent(kind)}&target_id=${targetId}`
    ) as Promise<ContentEngagementBundle>,

  toggleReaction: (kind: ContentEngagementKind, targetId: number, emoji: string) =>
    api.post('/api/content-engagement/reaction', {
      kind,
      target_id: targetId,
      emoji,
    }) as Promise<{ reactions: MessageReactionSummary[]; myEmoji: string | null }>,

  addComment: (kind: ContentEngagementKind, targetId: number, body: string) =>
    api.post('/api/content-engagement/comments', {
      kind,
      target_id: targetId,
      body,
    }) as Promise<{ comment: ContentCommentRow }>,

  deleteComment: (commentId: number) =>
    api.post('/api/content-engagement/comments/delete', { comment_id: commentId }) as Promise<{
      ok: boolean
    }>,
}
