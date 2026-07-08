import { api } from '@/lib/api-client'
import type { PostType } from '@/lib/db-posts'

export type CommunityPost = {
  id: number
  community_id: number
  author_id: number
  type: PostType
  content: string
  created_at: string
  author_pseudo: string
  author_avatar_emoji: string
  author_avatar: string | null
  wall_public: boolean
}

export const postsApi = {
  list: (communityId: number, limit = 20) =>
    api.get(`/api/posts?communityId=${communityId}&limit=${limit}`) as Promise<{
      community_id: number
      posts: CommunityPost[]
      can_manage?: boolean
    }>,
  create: (body: { community_id: number; type: PostType; content: string; wall_public?: boolean }) =>
    api.post('/api/posts', body) as Promise<{ post: CommunityPost }>,
  update: (postId: number, body: { wall_public: boolean }) =>
    api.patch(`/api/posts/${postId}`, body) as Promise<{ post: CommunityPost }>,
  remove: (postId: number) => api.delete(`/api/posts/${postId}`) as Promise<{ ok: boolean }>,
}
