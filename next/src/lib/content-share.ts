/** Deep links publics / app pour contenus mur. */

export type ContentEngagementKind = 'event' | 'post' | 'announcement'

export function isContentEngagementKind(v: unknown): v is ContentEngagementKind {
  return v === 'event' || v === 'post' || v === 'announcement'
}

export function contentSharePath(
  kind: ContentEngagementKind,
  placeSlug: string,
  targetId: number
): string {
  const slug = encodeURIComponent(placeSlug)
  const id = Math.max(0, Math.floor(targetId))
  switch (kind) {
    case 'event':
      return `/lieux/${slug}/evenements/${id}`
    case 'announcement':
      return `/lieux/${slug}/annonces/${id}`
    case 'post':
      return `/lieux/${slug}/agora/${id}`
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function contentShareAbsoluteUrl(
  kind: ContentEngagementKind,
  placeSlug: string,
  targetId: number,
  origin?: string
): string {
  const path = contentSharePath(kind, placeSlug, targetId)
  if (origin) return `${origin.replace(/\/$/, '')}${path}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  return path
}

export function contentShareLabel(kind: ContentEngagementKind): string {
  switch (kind) {
    case 'event':
      return 'événement'
    case 'announcement':
      return 'annonce'
    case 'post':
      return 'publication'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}
