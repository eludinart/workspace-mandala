/** Deep link public d’un lieu Mandala (`profile_public`). */

export function placePublicPath(slug: string): string {
  const s = String(slug || '')
    .trim()
    .replace(/^\/+/, '')
  return `/lieux/${encodeURIComponent(s)}`
}

export function placePublicAbsoluteUrl(slug: string, origin?: string): string {
  const path = placePublicPath(slug)
  if (origin) return `${origin.replace(/\/$/, '')}${path}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  return `https://mandala.eludein.art${path}`
}

export function placeShareText(placeName: string): string {
  const name = placeName.trim() || 'un lieu'
  return `${name} sur Mandala`
}
