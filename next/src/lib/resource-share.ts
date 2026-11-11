/** Deep link public d’une ressource (`scope === 'mandala'`). */

export function resourcePublicPath(resourceId: number): string {
  const id = Math.max(0, Math.floor(resourceId))
  return `/ressources/${id}`
}

export function resourcePublicAbsoluteUrl(resourceId: number, origin?: string): string {
  const path = resourcePublicPath(resourceId)
  if (origin) return `${origin.replace(/\/$/, '')}${path}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  return `https://mandala.eludein.art${path}`
}

export function resourceShareText(title: string): string {
  const t = title.trim() || 'une ressource'
  return `${t} · Mandala`
}
