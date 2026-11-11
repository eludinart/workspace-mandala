/** Deep link public d’une fiche compétences (scope Mandala). */

export function skillFichePublicPath(userId: number): string {
  const id = Math.max(0, Math.floor(userId))
  return `/competences/${id}`
}

export function skillFichePublicAbsoluteUrl(userId: number, origin?: string): string {
  const path = skillFichePublicPath(userId)
  if (origin) return `${origin.replace(/\/$/, '')}${path}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  return `https://mandala.eludein.art${path}`
}

export function skillFicheShareText(displayName: string): string {
  const name = displayName.trim() || 'une personne'
  return `Fiche Mandala de ${name}`
}
