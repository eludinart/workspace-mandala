/** Href fiche publique /lieux/[slug], ou null si le lieu n’expose pas de profil (évite un 404). */
export function publicPlaceProfileHref(place: {
  slug: string
  profile_public?: boolean | null
}): string | null {
  const slug = place.slug?.trim()
  if (!slug) return null
  if (place.profile_public === false) return null
  return `/lieux/${encodeURIComponent(slug)}`
}
