import { api } from '@/lib/api-client'

export const socialApi = {
  visitLisiere: (userId: string) =>
    api.get(`/api/social/visit_lisiere?user_id=${encodeURIComponent(userId)}`),
  sendSeed: (targetUserId: string, intentionId: string) =>
    api.post('/api/social/send_seed', { targetUserId, intentionId }),
  acceptConnection: (seedId: string) =>
    api.post('/api/social/accept_connection', { seedId }),
  rejectConnection: (seedId: string) =>
    api.post('/api/social/reject_connection', { seedId }),
  pendingSeedsIncoming: (params: { intention_ids?: string; limit?: number } = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
    const q = new URLSearchParams(clean as Record<string, string>).toString()
    return api.get(`/api/social/pending_seeds_incoming${q ? '?' + q : ''}`)
  },
  getMyChannels: (communitySlug?: string) => {
    const q = communitySlug ? `?community_slug=${encodeURIComponent(communitySlug)}` : ''
    return api.get(`/api/social/my_channels${q}`)
  },
  openChannel: (targetUserId: number, communitySlug: string) =>
    api.post('/api/social/open_channel', {
      target_user_id: targetUserId,
      community_slug: communitySlug,
    }) as Promise<{ channelId: number }>,
  openGroupChannel: (memberUserIds: number[], communitySlug: string, name?: string) =>
    api.post('/api/social/open_group_channel', {
      member_user_ids: memberUserIds,
      community_slug: communitySlug,
      name,
    }) as Promise<{ channelId: number; isNew: boolean }>,
  renameGroupChannel: (channelId: number, name: string) =>
    api.post('/api/social/rename_group_channel', { channelId, name }) as Promise<{
      channelId: number
      name: string
    }>,
  updateGroupChannelIcon: (
    channelId: number,
    payload: { emoji?: string | null; image?: string | null }
  ) =>
    api.post('/api/social/update_group_channel_icon', {
      channelId,
      emoji: payload.emoji ?? null,
      image: payload.image ?? null,
    }) as Promise<{ channelId: number }>,
  getChannelMessages: (channelId: string) =>
    api.get(`/api/social/channel_messages?channel_id=${encodeURIComponent(channelId)}`),
  sendMessage: (channelId: string, payload: Record<string, unknown>) =>
    api.post('/api/social/send_message', { channelId, ...payload }),
  presenceHeartbeat: () => api.get('/api/social/presence_heartbeat'),
  clairiereUnreadCount: () =>
    api.get('/api/social/clairiere_unread_count') as Promise<{ count: number }>,
  markChannelRead: (channelId: number) =>
    api.post('/api/social/mark_channel_read', { channelId }),
  toggleMessageReaction: (messageId: number, emoji: string) =>
    api.post('/api/social/message_reaction', { messageId, emoji }) as Promise<{
      messageId: number
      reactions: { emoji: string; userIds: number[] }[]
      myEmoji: string | null
    }>,
}

export const INTENTIONS = [
  { id: 'resonance', label: 'Partager une résonance' },
  { id: 'eclairage', label: "Demander un éclairage" },
  { id: 'ludus', label: 'Exploration Ludus' },
  { id: 'philia', label: "Créer un lien d'amitié" },
  { id: 'agape', label: 'Offrir une présence bienveillante' },
]
