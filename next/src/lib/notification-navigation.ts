import type { MandalaNavigate, MandalaPage } from '@/components/MandalaApp'
import type { NotificationItem } from '@/contexts/NotificationContext'
import { socialApi } from '@/api/social'

export type NotificationNavigationTarget = {
  page: MandalaPage
  messagesChannelId?: string
  messagesUserId?: string
  communitySlug?: string
}

const APP_PAGES: MandalaPage[] = [
  'home',
  'calendar',
  'events',
  'members',
  'messages',
  'notifications',
  'account',
  'charter',
  'places-map',
  'place-settings',
  'place-profile',
  'place-charter',
  'place-members',
  'place-announcements',
  'managed-places',
  'courses',
  'logistics',
  'circles',
  'admin',
]

function parseMandalaDeepLink(url: string): Partial<NotificationNavigationTarget> | null {
  if (!url.startsWith('mandala:')) return null
  const rest = url.slice(8)
  const [pagePart, queryPart] = rest.split('?')
  const page = pagePart as MandalaPage
  if (!APP_PAGES.includes(page)) return null
  const params = new URLSearchParams(queryPart ?? '')
  const channelId = params.get('channelId') ?? params.get('channel_id')
  const community = params.get('community') ?? params.get('community_slug')
  const userId = params.get('userId') ?? params.get('user_id')
  return {
    page,
    messagesChannelId: channelId?.trim() || undefined,
    communitySlug: community?.trim() || undefined,
    messagesUserId: userId?.trim() || undefined,
  }
}

function parseLegacyClairiereUrl(url: string): string | null {
  const match = url.match(/\/clairiere\/(\d+)/i)
  return match?.[1] ?? null
}

export function parseNotificationTarget(notif: NotificationItem): NotificationNavigationTarget | null {
  const type = (notif.type ?? '').toLowerCase()
  const isChat =
    type.includes('message') ||
    type.includes('clairiere') ||
    type.includes('chat') ||
    notif.source_type === 'clairiere_channel'

  const channelFromField =
    notif.channel_id != null && String(notif.channel_id).trim() !== ''
      ? String(notif.channel_id)
      : notif.source_type === 'clairiere_channel' && notif.source_id
        ? String(notif.source_id)
        : null

  const url = notif.action_url?.trim()
  if (url) {
    const mandala = parseMandalaDeepLink(url)
    if (mandala?.page) {
      return {
        page: mandala.page,
        messagesChannelId: mandala.messagesChannelId ?? channelFromField ?? undefined,
        messagesUserId: mandala.messagesUserId,
        communitySlug: mandala.communitySlug,
      }
    }

    const lower = url.toLowerCase()
    const legacyChannel = parseLegacyClairiereUrl(url)
    if (legacyChannel || lower.includes('clairiere') || lower.includes('chat') || lower.includes('message')) {
      return {
        page: 'messages',
        messagesChannelId: legacyChannel ?? channelFromField ?? undefined,
      }
    }
    if (lower.includes('event')) return { page: 'events' }
    if (lower.includes('member')) return { page: 'members' }
    if (lower.startsWith('http')) return null
  }

  if (isChat) {
    return {
      page: 'messages',
      messagesChannelId: channelFromField ?? undefined,
    }
  }
  if (type.includes('event')) return { page: 'events' }
  if (type.includes('announcement')) return { page: 'home' }
  return null
}

export async function navigateFromNotification(
  notif: NotificationItem,
  deps: {
    onNavigate: MandalaNavigate
    setActiveSlug: (slug: string, opts?: { notify?: boolean; reason?: 'notification' }) => void
    currentSlug?: string | null
  }
): Promise<boolean> {
  const target = parseNotificationTarget(notif)
  if (!target) {
    if (notif.action_url?.trim().toLowerCase().startsWith('http')) {
      window.open(notif.action_url!, '_blank', 'noopener,noreferrer')
      return true
    }
    return false
  }

  let { messagesChannelId, messagesUserId, communitySlug } = target

  if (messagesChannelId && !communitySlug) {
    try {
      const ctx = (await socialApi.getChannelContext(Number(messagesChannelId))) as {
        communitySlug?: string | null
        otherUserId?: number | null
      }
      if (ctx.communitySlug) communitySlug = ctx.communitySlug
      if (!messagesUserId && ctx.otherUserId) messagesUserId = String(ctx.otherUserId)
    } catch {
      /* contexte optionnel pour anciennes notifications */
    }
  }

  if (communitySlug) {
    deps.setActiveSlug(communitySlug, {
      notify: communitySlug !== (deps.currentSlug ?? null),
      reason: 'notification',
    })
  }

  if (target.page === 'messages') {
    deps.onNavigate('messages', {
      messagesChannelId,
      messagesUserId,
      communitySlug,
    })
    return true
  }

  deps.onNavigate(target.page)
  return true
}
